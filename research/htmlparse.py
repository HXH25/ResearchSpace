from html.parser import HTMLParser
import re

class Document(HTMLParser):
    def __init__(self,html):
        super().__init__(convert_charrefs=True)
        self.parts=[]; self.links=[]; self.heading=[]; self.titles=[]
        self._hidden=0; self._a=None; self._title=0; self._h1=0
        self.feed(html)
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag in ('script','style'): self._hidden+=1
        if self._hidden: return
        if tag=='a': self._a=[attrs.get('href',''),'']
        if tag=='title': self._title+=1
        if tag=='h1': self._h1+=1
        if tag in ('p','div','br','li','tr','td','h1','h2','h3','h4','label','section','article'): self.parts.append('\n')
    def handle_endtag(self,tag):
        if tag in ('script','style'):
            self._hidden=max(0,self._hidden-1); return
        if self._hidden: return
        if tag=='a' and self._a:
            self.links.append(tuple(self._a)); self._a=None
        if tag=='title': self._title=0
        if tag=='h1': self._h1=0
        if tag in ('p','div','li','tr','td','h1','h2','h3','h4','label','section','article'): self.parts.append('\n')
    def handle_data(self,text):
        if self._hidden: return
        self.parts.append(text)
        if self._a: self._a[1]+=text
        if self._title: self.titles.append(text)
        if self._h1: self.heading.append(text)
    @property
    def lines(self):
        return [re.sub(r'\s+',' ',x).strip() for x in ''.join(self.parts).splitlines() if x.strip()]
    @property
    def text(self): return '\n'.join(self.lines)
    @property
    def title(self): return ''.join(self.heading).strip() or ''.join(self.titles).split('|')[0].strip()
    def section(self,label,stops):
        lines=self.lines
        for i,line in enumerate(lines):
            if line.rstrip(':：').casefold()==label.rstrip(':：').casefold():
                found=[]
                for item in lines[i+1:]:
                    if item.rstrip(':：').casefold() in {x.rstrip(':：').casefold() for x in stops}: break
                    found.append(item)
                return '\n'.join(found)
        return ''
