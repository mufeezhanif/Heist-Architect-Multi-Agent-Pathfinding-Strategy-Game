from fastapi import FastAPI, Request

app = FastAPI()

@app.api_route("/{path:path}", methods=["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"])  
async def echo(request: Request, path: str):
    try:
        body = await request.json()
    except Exception:
        body = (await request.body()).decode(errors='ignore') or None

    return {
        "method": request.method,
        "path": f"/{path}",
        "headers": {k: v for k, v in request.headers.items()},
        "body": body,
    }
