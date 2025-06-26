# ComfyUI/custom_nodes/ram_nodes/server.py
from aiohttp import web
import server
import os

SESSION_KEYS = {}


def generate_key():
    return os.urandom(32)


@server.PromptServer.instance.routes.post("/ram_nodes/get_key")
async def get_key(request):
    """API endpoint to generate and return a session key."""
    try:
        # This is the fix for the 500 error: await the async call.
        json_data = await request.json()
        client_id = json_data.get("client_id")

        if not client_id:
            return web.Response(status=400, text="Client ID is required")

        key = generate_key()
        SESSION_KEYS[client_id] = key

        return web.json_response({"key": key.hex()})
    except Exception as e:
        print(f"Error in /ram_nodes/get_key: {e}")
        return web.Response(status=500, text=str(e))


def get_session_key(client_id):
    return SESSION_KEYS.get(client_id)
