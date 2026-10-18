"""Run the prebuilt app with Python. Frontend development uses npm separately."""
import argparse
import sys
from pathlib import Path


def main():
    if sys.version_info < (3, 11):
        raise SystemExit('Python 3.11+ required')
    parser = argparse.ArgumentParser(description='ResearchSpace local server')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    if not (Path(__file__).parent / 'dist/index.html').exists():
        raise SystemExit('dist/index.html missing; run npm ci and npm run build, or use the complete ZIP.')
    try:
        import uvicorn
    except ImportError:
        raise SystemExit('Install dependencies first: python -m pip install -r requirements.txt') from None
    print(f'ResearchSpace: http://127.0.0.1:{args.port}', flush=True)
    uvicorn.run('server.app:app', host='127.0.0.1', port=args.port, access_log=False)


if __name__ == '__main__':
    main()
