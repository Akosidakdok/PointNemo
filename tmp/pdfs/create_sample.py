from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader
import json

out = Path('output/pdf/point-nemo-marine-biology.pdf')
out.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(out), pagesize=A4)
c.setTitle('Introduction to Marine Biology')
c.setAuthor('Point Nemo - Sample Study Material')
W, H = A4
body = ParagraphStyle('body', fontName='Helvetica', fontSize=11, leading=17, textColor=HexColor('#253C4A'))
heading = ParagraphStyle('heading', fontName='Helvetica-Bold', fontSize=16, leading=21, textColor=HexColor('#075E6B'))
y = 0

def para(text, style=body, gap=12):
    global y
    p = Paragraph(text, style)
    _, h = p.wrap(W-104, H)
    p.drawOn(c, 52, y-h)
    y -= h + gap

def page(n, label):
    global y
    c.setFillColor(HexColor('#073846'))
    c.rect(0, H-15, W, 15, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(52, H-49, 'POINT NEMO / STUDY NOTES')
    c.setFillColor(HexColor('#627581'))
    c.setFont('Helvetica', 9)
    c.drawString(52, 34, 'Introduction to Marine Biology')
    c.drawRightString(W-52, 34, str(n) + ' / 2')
    y = H-83
    para(label, ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=25, leading=30, textColor=HexColor('#073846')), 16)

page(1, 'Life in the ocean')
para('An introductory lesson on ocean zones, food webs, and adaptations. Each topic provides facts and explanations that can support study questions.')
para('1. Ocean zones and sunlight', heading)
para('The sunlit zone is the upper ocean layer where enough sunlight is available for photosynthesis. Phytoplankton are microscopic organisms that drift in the water. Many phytoplankton use sunlight, carbon dioxide, and water to make sugars through photosynthesis. This process also releases oxygen.')
para('Light becomes weaker as depth increases because seawater absorbs and scatters it. The twilight zone receives some light, but generally not enough to support photosynthesis. The deeper midnight zone receives no sunlight. These zones describe light conditions; they are not separate bodies of water.')
para('Photosynthesis depends on light, so it is concentrated near the ocean surface. An organism living in the midnight zone cannot rely on sunlight to produce its food. Food can still reach deep habitats when organic material sinks from shallower water.')
para('2. Energy in marine food webs', heading)
para('A producer makes organic food from an energy source. In a sunlit marine food web, phytoplankton are important producers. A consumer obtains energy by eating other organisms. Zooplankton that eat phytoplankton are primary consumers; small fish that eat those zooplankton are secondary consumers.')
para('One example food chain is phytoplankton to zooplankton to small fish to a larger predatory fish. The arrows show the direction in which food energy moves. A food web connects many food chains because a species may eat several kinds of food and may have several predators.')
assert y > 65, y
c.showPage()
page(2, 'Surviving below the surface')
para('2. Energy in marine food webs / continued', heading)
para('At each feeding step, organisms use energy for movement, growth, and other life processes. Some energy is released as heat, so less energy is available to the next feeding level. This helps explain why food webs generally support fewer large predators than small organisms near the base.')
para('Decomposers, including many bacteria, break down dead organisms and waste. Decomposition returns nutrients to the environment, where producers can use them again. Nutrients cycle through ecosystems, while energy flows through them and is eventually dispersed as heat.')
para('3. Adaptations to deep water', heading)
para('An adaptation is an inherited characteristic that helps an organism survive or reproduce in its environment. Deep ocean habitats have little or no sunlight, high pressure, and often limited food. Different species have different adaptations; no single feature describes all deep-sea animals.')
para('Bioluminescence is light produced by living organisms through chemical reactions. Some deep-sea animals use it to attract prey, communicate, or avoid predators. It is different from reflecting light: a bioluminescent organism produces light rather than merely reflecting an outside source.')
para('Marine snow consists of sinking organic particles, including dead plankton and waste. It carries food from upper waters into deeper habitats. Some deep-sea animals conserve energy by moving slowly or waiting for prey, which can help when meals are scarce.')
para('Near some hydrothermal vents, certain microbes use energy from chemical reactions to make organic food. This process is called chemosynthesis. Unlike photosynthesis, chemosynthesis does not require sunlight. These microbes can support local food webs in otherwise dark surroundings.')
para('Connections to remember', heading)
para('Sunlight supports photosynthesis near the surface. Feeding transfers energy through food webs. Sinking organic matter links surface life to deep habitats, while chemosynthesis provides another source of food production in some deep environments.')
assert y > 65, y
c.save()
r = PdfReader(str(out))
texts = [p.extract_text() or '' for p in r.pages]
assert len(texts) == 2
assert all(len(''.join(t.split())) > 300 for t in texts)
assert 300 <= len('\n'.join(texts)) <= 8000
assert out.stat().st_size < 5242880
print(json.dumps({'path': str(out.resolve()), 'pages': len(texts), 'characters': len('\n'.join(texts)), 'bytes': out.stat().st_size}))
try:
    import pymupdf
    doc = pymupdf.open(str(out))
    for i, p in enumerate(doc):
        p.get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(f'tmp/pdfs/sample-page-{i+1}.png')
    print('Rendered both pages using MuPDF.')
except ImportError:
    import shutil, subprocess
    exe = shutil.which('pdftoppm')
    if not exe:
        raise RuntimeError('No PDF renderer available')
    subprocess.run([exe, '-scale-to', '1100', '-png', str(out), 'tmp/pdfs/sample-page'], check=True)
