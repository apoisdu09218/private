from . import server
from .ram_nodes import LoadImageFromUpload, PreviewImageInRAM, PreviewVideoInRAM, PreviewAnimationAsWebP # Added PreviewAnimationAsWebP

NODE_CLASS_MAPPINGS = {
    "LoadImageFromUpload": LoadImageFromUpload,
    "PreviewImageInRAM": PreviewImageInRAM,
    "PreviewVideoInRAM": PreviewVideoInRAM,
    "PreviewAnimationAsWebP": PreviewAnimationAsWebP, # Added new node
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadImageFromUpload": "Load Image (Privacy)",
    "PreviewImageInRAM": "Preview Image (Privacy)",
    "PreviewVideoInRAM": "Preview Video (Privacy)",
    "PreviewAnimationAsWebP": "Preview Animation as WebP (Privacy)", # Added new node
}
WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]