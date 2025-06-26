from . import server
# Import the new EncryptedText class along with the others
from .ram_nodes import LoadImageFromUpload, PreviewImageInRAM, PreviewVideoInRAM, PreviewAnimationAsWebP, EncryptedText

NODE_CLASS_MAPPINGS = {
    "LoadImageFromUpload": LoadImageFromUpload,
    "PreviewImageInRAM": PreviewImageInRAM,
    "PreviewVideoInRAM": PreviewVideoInRAM,
    "PreviewAnimationAsWebP": PreviewAnimationAsWebP,
    "EncryptedText": EncryptedText,  # Add the new node class
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadImageFromUpload": "Load Image (Privacy)",
    "PreviewImageInRAM": "Preview Image (Privacy)",
    "PreviewVideoInRAM": "Preview Video (Privacy)",
    "PreviewAnimationAsWebP": "Preview Animation as WebP (Privacy)",
    "EncryptedText": "Encrypted Text (Privacy)",  # Add the new node's display name
}
WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
