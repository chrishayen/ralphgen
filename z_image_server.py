#!/usr/bin/env python3
"""FastAPI server for Z-Image generation with Ralph LoRA."""

import os
import io
import base64
import torch
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from diffusers import ZImagePipeline

# Configuration
MODEL_PATH = os.environ.get("ZIMAGE_MODEL", "Tongyi-MAI/Z-Image-Turbo")
LORA_PATH = os.environ.get("ZIMAGE_LORA",
    os.path.join(os.path.dirname(__file__), "ralphwiggum.safetensors")
)
LORA_STRENGTH = float(os.environ.get("LORA_STRENGTH", "1.0"))

DEFAULT_WIDTH = 512
DEFAULT_HEIGHT = 512
DEFAULT_STEPS = 9  # Results in 8 DiT forwards for turbo
DEFAULT_GUIDANCE = 0.0  # Turbo models use 0.0

# Global pipeline
pipe = None


class GenerateRequest(BaseModel):
    prompt: str
    width: int = DEFAULT_WIDTH
    height: int = DEFAULT_HEIGHT
    steps: int = DEFAULT_STEPS
    guidance_scale: float = DEFAULT_GUIDANCE
    seed: int | None = None


class GenerateResponse(BaseModel):
    image: str  # base64 data URL


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global pipe

    print(f"Loading Z-Image pipeline from {MODEL_PATH}...")
    pipe = ZImagePipeline.from_pretrained(
        MODEL_PATH,
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=True,
    )
    pipe.to("cuda")

    # Load LoRA if it exists
    lora_file = Path(LORA_PATH)
    if lora_file.exists():
        print(f"Loading LoRA from {LORA_PATH}...")
        pipe.load_lora_weights(LORA_PATH)
        pipe.fuse_lora(lora_scale=LORA_STRENGTH)
        print(f"LoRA loaded with strength {LORA_STRENGTH}")
    else:
        print(f"LoRA not found at {LORA_PATH}, running without LoRA")

    # Optional optimizations
    try:
        pipe.transformer.set_attention_backend("flash")
        print("Flash attention enabled")
    except Exception:
        pass

    print("Pipeline ready!")
    yield

    # Cleanup
    pipe = None
    torch.cuda.empty_cache()


app = FastAPI(title="Z-Image Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """Generate an image from a prompt."""
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    prompt = request.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Empty prompt")

    print(f"Generating: {prompt[:80]}...")

    # Set up generator for reproducibility
    generator = None
    if request.seed is not None:
        generator = torch.Generator("cuda").manual_seed(request.seed)

    # Generate image
    result = pipe(
        prompt=prompt,
        height=request.height,
        width=request.width,
        num_inference_steps=request.steps,
        guidance_scale=request.guidance_scale,
        generator=generator,
    )

    image = result.images[0]

    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    print("Generation complete")

    return GenerateResponse(image=f"data:image/png;base64,{image_base64}")


@app.post("/reload-lora")
async def reload_lora():
    """Reload the LoRA weights (useful after training updates)."""
    global pipe

    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    lora_file = Path(LORA_PATH)
    if not lora_file.exists():
        raise HTTPException(status_code=404, detail=f"LoRA not found: {LORA_PATH}")

    print(f"Reloading LoRA from {LORA_PATH}...")

    # Unfuse and unload existing LoRA
    try:
        pipe.unfuse_lora()
        pipe.unload_lora_weights()
    except Exception:
        pass

    # Load fresh
    pipe.load_lora_weights(LORA_PATH)
    pipe.fuse_lora(lora_scale=LORA_STRENGTH)

    print("LoRA reloaded")
    return {"status": "ok", "lora": LORA_PATH}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": MODEL_PATH,
        "lora": LORA_PATH if Path(LORA_PATH).exists() else None,
        "cuda": torch.cuda.is_available(),
    }


def main():
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
