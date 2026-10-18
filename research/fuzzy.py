"""Shared local search: aliases, substrings, multi-term AND and bounded typos."""
import re
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache

EXTRA_ALIASES = [
    ['电气工程', 'electrical engineering', '电气'],
    ['大语言模型', '大模型', '语言模型', 'llm', 'llms', 'large language models'],
    ['机器学习', 'machine learning', 'ml'], ['人工智能', 'artificial intelligence', 'ai'],
    ['蛋白质', 'protein', 'proteins'], ['自动化', 'automation'],
    ['计算机系', '计算机科学与技术系'], ['电子系', '电子工程系'],
]

def normalize(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', str(text)).casefold()).strip()

def has(text, term):
    return bool(re.search(r'(?<![a-z0-9])' + re.escape(term) + r'(?![a-z0-9])', text)) if re.fullmatch(r'[a-z0-9 .+-]+', term) else term in text

@lru_cache(maxsize=12000)
def expanded(text):
    from .matching import ALIASES
    text = normalize(text)
    additions = [v for group in ALIASES + EXTRA_ALIASES if any(has(text, normalize(v)) for v in group) for v in group]
    return text + ' ' + ' '.join(additions)

@lru_cache(maxsize=12000)
def words(text):
    return set(re.findall(r'[a-z][a-z0-9-]+', text)), re.findall(r'[\u3400-\u9fff]+', text)

def fuzzy_score(text, query, fuzzy=True):
    query = normalize(query)
    if not query:
        return 1.0
    text = expanded(text)
    terms = re.findall(r'[a-z0-9-]+|[\u3400-\u9fff]+', query)
    if not terms:
        return 1.0 if query in text else 0.0
    scores = []
    latin, chinese = words(text)
    for term in terms:
        if term in text:
            scores.append(1.0)
            continue
        if not fuzzy:
            return 0.0
        score = 0.0
        if re.fullmatch('[a-z-]{4,}', term):
            score = max((SequenceMatcher(None, term, w).ratio() for w in latin if abs(len(term) - len(w)) <= 2), default=0)
            if score < .78:
                return 0.0
        elif re.fullmatch('[\u3400-\u9fff]{4,}', term):
            # One mistyped character; never fuzzy-match two-character names.
            n = len(term)
            score = max((sum(a == b for a, b in zip(term, chunk[i:i+n])) / n for chunk in chinese for i in range(max(0, len(chunk)-n+1))), default=0)
            if score < max(.75, (n-1)/n):
                return 0.0
        else:
            return 0.0
        scores.append(score * .8)
    return sum(scores) / len(scores)

def academic_query(query):
    """Translate only known topic aliases; preserve names and unknown phrases."""
    from .matching import ALIASES
    for group in EXTRA_ALIASES + ALIASES:
        english = next((x for x in group if re.fullmatch(r'[a-zA-Z][a-zA-Z -]{3,}', x)), None)
        if english:
            for term in sorted(group, key=len, reverse=True):
                if re.search('[\u3400-\u9fff]', term):
                    query = query.replace(term, english)
    return query
