import uvicorn
from fastapi import FastAPI, Query, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional

from annas_resolver import search_libgen, resolve_download_stream

app = FastAPI(
    title="Luca Books Python Resolver",
    description="Python microservice powered by curl_cffi for Anna's Archive & LibGen books search and streaming download",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Content-Length", "Accept-Ranges"]
)

@app.get("/health")
@app.get("/api/py/health")
async def health_check():
    return {"status": "ok", "service": "Luca-Books Python Anna Resolver"}

@app.get("/search")
@app.get("/api/py/search")
async def search_books(
    q: str = Query(..., description="Query string for book search"),
    lang: str = Query("all", description="Language filter (pt, en, all)"),
    format: str = Query("epub", description="Format filter (epub, pdf, all)")
):
    if not q or not q.strip():
        return {"query": "", "count": 0, "results": []}

    print(f"[FastAPI /search] Searching for '{q}' (lang={lang}, format={format})")
    results = search_libgen(query=q, format_filter=format, lang_filter=lang)
    return {
        "query": q,
        "count": len(results),
        "results": results
    }

@app.get("/download")
@app.get("/api/py/download")
async def download_book(
    md5: Optional[str] = Query(None, description="MD5 hash of the book"),
    id: Optional[str] = Query(None, description="Book identifier or slug"),
    title: Optional[str] = Query(None, description="Book title for auto-recovery"),
    fallbackMd5s: Optional[str] = Query(None, description="Comma-separated fallback MD5s"),
    range: Optional[str] = Header(None)
):
    if not md5 and not id and not title:
        raise HTTPException(status_code=400, detail="Parâmetros insuficientes para download")

    print(f"[FastAPI /download] Requesting (md5={md5}, id={id}, title='{title}')")

    status_code, headers, stream_iter = resolve_download_stream(
        md5=md5,
        title=title,
        slug_or_id=id,
        range_header=range
    )

    if status_code not in [200, 206] or not stream_iter:
        return JSONResponse(
            status_code=502,
            content={"error": "Não foi possível resolver o espelho de download no momento."}
        )

    return StreamingResponse(
        stream_iter,
        status_code=status_code,
        headers=headers
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3089, reload=False)
