"""Raster companions to icons/cinema500.svg; no runtime dependencies."""
from pathlib import Path
from PIL import Image, ImageDraw
from math import hypot
root=Path(__file__).resolve().parent.parent
scale=3
im=Image.new('RGB',(512*scale,512*scale))
pixels=im.load()
for y in range(im.height):
 for x in range(im.width):
  t=min(1,hypot(x/im.width-.3,y/im.height-.2))
  pixels[x,y]=tuple(round(a+(b-a)*t) for a,b in zip((40,36,56),(11,13,19)))
d=ImageDraw.Draw(im)
def box(b):return tuple(round(v*scale) for v in b)
def rr(b,r,fill=None,outline=None,width=1):d.rounded_rectangle(box(b),radius=r*scale,fill=fill,outline=outline,width=width*scale)
def line(points,color,width):
 pts=[(x*scale,y*scale) for x,y in points];d.line(pts,fill=color,width=width*scale,joint='curve')
 for x,y in points:d.ellipse(box((x-width/2,y-width/2,x+width/2,y+width/2)),fill=color)
rr((128,116,384,332),45,fill=(34,32,45),outline=(192,174,234),width=12)
for x in (174,338):line([(x,122),(x,326)],(112,103,138),4)
for x in (145,355):
 for y in (144,185,226,267):rr((x,y,x+12,y+22),5,fill=(197,179,239))
d.polygon([(231*scale,180*scale),(309*scale,223*scale),(231*scale,267*scale)],fill=(214,198,250))
line([(225,358),(198,358),(198,378),(215,378),(226,385),(226,397),(217,405),(196,405)],(209,193,244),8)
for x in (244,291):rr((x,358,x+29,405),14,outline=(209,193,244),width=8)
for size,name in [(512,'icon-512.png'),(192,'icon-192.png'),(180,'apple-touch-icon.png')]:
 im.resize((size,size),Image.Resampling.LANCZOS).save(root/'icons'/name,optimize=True)
