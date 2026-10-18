"""Browser QA server: real local APIs/database, synthetic OpenAlex upstream only."""
import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import httpx
import uvicorn
from server.app import create_app

def upstream(request):
    if request.url.host != 'api.openalex.org':
        raise AssertionError('Unexpected external service in browser QA')
    author = {'id': 'https://openalex.org/A123', 'display_name': 'Synthetic OpenAlex Researcher'}
    if request.url.path == '/authors':
        rows = [dict(author, last_known_institutions=[{'display_name': 'QA University'}])]
    else:
        rows = [{'id': 'https://openalex.org/W123', 'title': 'Synthetic Machine Learning Paper', 'publication_year': 2025,
                 'doi': 'https://doi.org/10.1234/qa', 'primary_topic': {'display_name': 'Machine Learning'},
                 'authorships': [{'author': author, 'author_position': 'last', 'is_corresponding': True, 'institutions': [{'display_name': 'QA University'}]}]}]
    return httpx.Response(200, json={'meta': {'count': 1}, 'results': rows})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8013)
    uvicorn.run(create_app(transport=httpx.MockTransport(upstream)), host='127.0.0.1', port=parser.parse_args().port, access_log=False)
