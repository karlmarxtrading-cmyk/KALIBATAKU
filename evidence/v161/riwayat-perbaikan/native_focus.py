from playwright.sync_api import sync_playwright,expect
from pathlib import Path
from urllib.parse import quote
import json
html='''<!doctype html><meta charset=utf-8><html style="scroll-padding:6px"><body style="margin:0"><section style="height:945px"></section><details><summary style="height:44px">Langkah lengkap</summary><article style="height:61px">1 + 1 = 2</article></details><footer style="height:399px"></footer></body></html>'''
with sync_playwright() as pw:
 browser=pw.firefox.launch();ctx=browser.new_context(viewport={'width':390,'height':370},reduced_motion='reduce');p=ctx.new_page()
 for i in range(12):
  p.goto('data:text/html;charset=utf-8,'+quote(html));summary=p.locator('summary')
  p.evaluate("window.scrollTo(0,400)")
  summary.focus();p.keyboard.down('Enter');p.keyboard.up('Enter');expect(p.locator('details')).to_have_attribute('open','')
  p.evaluate("window.scrollTo(0,document.documentElement.scrollHeight)")
  before=p.evaluate("scrollY"); after=p.evaluate("async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>requestAnimationFrame(resolve));return [scrollY,document.documentElement.scrollHeight,document.activeElement.tagName]}")
  print(before,after,flush=True)
 browser.close()
