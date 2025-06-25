import torch
import numpy as np
from PIL import Image, ImageOps  # PIL is essential for WebP creation
import base64
import io
from itertools import cycle
import hashlib

from .server import get_session_key


def xor_cipher(data, key):
    if not key:
        raise ValueError("XOR key cannot be empty")
    return bytes(a ^ b for a, b in zip(data, cycle(key)))


# --- LoadImageFromUpload class (unchanged) ---
class LoadImageFromUpload:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"encrypted_upload": ("STRING", {"multiline": True, "default": ""}),
                             "client_id": ("STRING", {"multiline": False, "default": ""}), }}

    CATEGORY = "image"
    RETURN_TYPES = ("IMAGE", "MASK")
    FUNCTION = "load_image"

    def load_image(self, encrypted_upload, client_id):
        if not encrypted_upload: return (torch.empty(0), torch.empty(0))
        if not client_id: raise Exception("The 'client_id' field on the LoadImage (Privacy) node cannot be empty.")
        obfuscated_data = base64.b64decode(encrypted_upload)
        key = get_session_key(client_id)
        if not key: raise Exception(f"Could not find session key for client_id: {client_id}.")
        image_data = xor_cipher(obfuscated_data, key)
        img = Image.open(io.BytesIO(image_data))
        img = ImageOps.exif_transpose(img)
        output_image = img.convert("RGB")
        output_image = np.array(output_image).astype(np.float32) / 255.0
        output_image = torch.from_numpy(output_image)[None,]
        if 'A' in img.getbands():
            mask = 1. - torch.from_numpy(np.array(img.getchannel('A')).astype(np.float32) / 255.0)
        else:
            mask = torch.ones((img.height, img.width), dtype=torch.float32)
        mask = mask.unsqueeze(0)
        return (output_image, mask)

    @classmethod
    def IS_CHANGED(s, encrypted_upload, client_id):
        return hashlib.sha256((encrypted_upload + client_id).encode()).hexdigest()


# --- PreviewImageInRAM class (unchanged) ---
class PreviewImageInRAM:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"images": ("IMAGE",), "client_id": ("STRING", {"multiline": False, "default": ""}), }}

    RETURN_TYPES = ()
    FUNCTION = "preview_images"
    OUTPUT_NODE = True
    CATEGORY = "image"

    def preview_images(self, images, client_id=None):
        if not client_id: raise Exception("The 'client_id' field on the PreviewImage (Privacy) node cannot be empty.")
        key = get_session_key(client_id)
        if not key: raise Exception(f"Could not find session key for client_id: {client_id}.")
        results = []
        for image_tensor in images:
            i = 255. * image_tensor.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            buffer = io.BytesIO()
            img.save(buffer, 
                     format="webp",
                     lossless=True,
                     quality=100,
                     method=6)
            image_data_bytes = buffer.getvalue()
            obfuscated_data = xor_cipher(image_data_bytes, key)
            img_base64 = base64.b64encode(obfuscated_data).decode('utf-8')
            results.append({"base64": img_base64, "format": "png", "type": "image"})  # Added type for JS
        return {"ui": {"previews": results}}  # Changed key to 'previews' for clarity


# --- PreviewVideoInRAM class (unchanged, but kept for completeness if you use it) ---
class PreviewVideoInRAM:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"video_data": ("VIDEO_BYTES",), "mime_type": ("STRING", {"default": "video/mp4"}),
                             "client_id": ("STRING", {"multiline": False, "default": ""}), }}

    RETURN_TYPES = ()
    FUNCTION = "preview_video"
    OUTPUT_NODE = True
    CATEGORY = "video"

    def preview_video(self, video_data, mime_type, client_id=None):
        if not client_id: raise Exception("The 'client_id' field on the PreviewVideo (Privacy) node cannot be empty.")
        if not video_data: return {"ui": {"previews": []}}
        key = get_session_key(client_id)
        if not key: raise Exception(f"Could not find session key for client_id: {client_id}.")
        video_bytes = video_data
        encrypted_video_bytes = xor_cipher(video_bytes, key)
        video_base64 = base64.b64encode(encrypted_video_bytes).decode('utf-8')
        results = [{"base64": video_base64, "mime_type": mime_type, "type": "video"}]  # Added type for JS
        return {"ui": {"previews": results}}  # Changed key to 'previews'


# +++ NEW CLASS: PreviewAnimationAsWebP +++
class PreviewAnimationAsWebP:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),  # Batch of image tensors
                "fps": ("FLOAT", {"default": 10.0, "min": 0.1, "max": 60.0, "step": 0.1}),
                "client_id": ("STRING", {"multiline": False, "default": ""}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "preview_animation"
    OUTPUT_NODE = True
    CATEGORY = "image"  # Or "animation" if you prefer

    def preview_animation(self, images, fps, client_id=None):
        if not client_id:
            raise Exception("The 'client_id' field on the PreviewAnimationAsWebP node cannot be empty.")
        if images is None or len(images) == 0:
            return {"ui": {"previews": []}}

        key = get_session_key(client_id)
        if not key:
            raise Exception(f"Could not find session key for client_id: {client_id}. Please refresh the page.")

        pil_images = []
        for image_tensor in images:
            i = 255. * image_tensor.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            pil_images.append(img.convert("RGB"))  # Ensure RGB for WebP

        if not pil_images:
            return {"ui": {"previews": []}}

        buffer = io.BytesIO()
        pil_images[0].save(
            buffer,
            format="WEBP",
            save_all=True,
            append_images=pil_images[1:],
            duration=int(1000 / fps),  # Duration per frame in milliseconds
            loop=0,  # 0 for infinite loop
            lossless=False,
            quality=90,  # For lossless, PIL uses quality as compression effort (0-100, 100 best)
            method=6  # Compression method (0-6, 6 slowest/best compression for lossless)
        )
        webp_bytes = buffer.getvalue()

        encrypted_webp_bytes = xor_cipher(webp_bytes, key)
        webp_base64 = base64.b64encode(encrypted_webp_bytes).decode('utf-8')

        results = [{
            "base64": webp_base64,
            "format": "webp",  # Specifically image/webp
            "type": "image"  # Still an image type for the <img> tag
        }]

        return {"ui": {"previews": results}}
