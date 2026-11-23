(function(){var d=document,U='https://api.leadconnectorhq.com/widget/bookings/strategy-call-merrick',dl,tr,pc,h=d.documentElement;
function warm(){if(pc)return;pc=1;var l=d.createElement('link');l.rel='preconnect';l.href='https://api.leadconnectorhq.com';d.head.appendChild(l)}
function open(a){tr=a;if(!dl){dl=d.createElement('dialog');dl.className='bk';dl.setAttribute('aria-labelledby','bk-h');
dl.innerHTML='<div class="bk-hd"><h2 id="bk-h">Book a strategy call</h2><button type="button" class="bk-x" aria-label="Close booking calendar">&times;</button></div><div class="bk-bd"><p class="bk-ld" role="status">Loading calendar&hellip;</p></div>';
d.body.appendChild(dl);dl.querySelector('.bk-x').onclick=function(){dl.close()};
dl.addEventListener('click',function(e){if(e.target===dl)dl.close()});
dl.addEventListener('close',function(){h.classList.remove('bk-lock');tr&&tr.focus()});
var f=d.createElement('iframe');f.title='Booking calendar for a strategy call with Merrick Lee';f.onload=function(){dl.classList.add('ok')};f.src=U;dl.querySelector('.bk-bd').appendChild(f)}
h.classList.add('bk-lock');dl.showModal()}
d.querySelectorAll('[data-book]').forEach(function(a){a.addEventListener('pointerenter',warm);a.addEventListener('focus',warm);
a.addEventListener('click',function(e){if(!window.HTMLDialogElement||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;e.preventDefault();open(a)})})})();
(function(){
var d=document,r=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* site nav: desktop dropdowns, mobile accordion */
var nav=d.querySelector('.site-nav'),btn=nav&&nav.querySelector('.menu-toggle');
if(nav){
  var items=[].slice.call(nav.querySelectorAll('.nav-item'));
  var hoverTimer=null;
  var desktop=function(){return window.matchMedia('(min-width:881px)').matches};
  var canHover=function(){return window.matchMedia('(hover:hover) and (pointer:fine)').matches};
  var closeItem=function(item){
    item.classList.remove('is-open');
    var b=item.querySelector('.nav-btn');
    if(b) b.setAttribute('aria-expanded','false');
  };
  var closeAll=function(except){
    items.forEach(function(item){if(item!==except)closeItem(item)});
  };
  var openItem=function(item){
    closeAll(item);
    item.classList.add('is-open');
    var b=item.querySelector('.nav-btn');
    if(b) b.setAttribute('aria-expanded','true');
  };
  var setMenu=function(o){
    if(!btn)return;
    nav.classList.toggle('open',o);
    btn.setAttribute('aria-expanded',o);
    var label=btn.querySelector('.mt-label');
    if(label) label.textContent=o?'Close':'Menu';
    if(!o) closeAll();
  };
  var topLevel=function(){
    var list=[];
    nav.querySelectorAll('.links > .nav-item > .nav-btn, .links > a').forEach(function(el){list.push(el)});
    return list;
  };
  var subLinks=function(item){return [].slice.call(item.querySelectorAll('.nav-sub a'))};
  var focusAt=function(list,i){if(!list.length)return;list[(i+list.length)%list.length].focus()};

  items.forEach(function(item){
    var b=item.querySelector('.nav-btn');
    if(!b)return;
    b.addEventListener('click',function(e){
      e.preventDefault();
      if(item.classList.contains('is-open')) closeItem(item);
      else openItem(item);
    });
    item.addEventListener('mouseenter',function(){
      if(!desktop()||!canHover())return;
      clearTimeout(hoverTimer);
      openItem(item);
    });
    item.addEventListener('mouseleave',function(){
      if(!desktop()||!canHover())return;
      clearTimeout(hoverTimer);
      hoverTimer=setTimeout(function(){closeItem(item)},140);
    });
    b.addEventListener('keydown',function(e){
      var links=subLinks(item);
      var tops=topLevel();
      var i=tops.indexOf(b);
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        if(item.classList.contains('is-open')) closeItem(item);
        else{openItem(item);if(desktop())focusAt(links,0)}
      }else if(e.key==='ArrowDown'){
        e.preventDefault();
        if(!item.classList.contains('is-open')) openItem(item);
        focusAt(links,0);
      }else if(e.key==='ArrowUp'){
        e.preventDefault();
        if(!item.classList.contains('is-open')) openItem(item);
        focusAt(links,links.length-1);
      }else if(e.key==='ArrowRight'){
        e.preventDefault();
        if(desktop()){closeItem(item);focusAt(tops,i+1)}
      }else if(e.key==='ArrowLeft'){
        e.preventDefault();
        if(desktop()){closeItem(item);focusAt(tops,i-1)}
      }else if(e.key==='Home'){
        e.preventDefault();focusAt(tops,0);
      }else if(e.key==='End'){
        e.preventDefault();focusAt(tops,tops.length-1);
      }else if(e.key==='Escape'){
        if(item.classList.contains('is-open')){e.preventDefault();closeItem(item);b.focus()}
        else if(nav.classList.contains('open')){e.preventDefault();setMenu(false);btn&&btn.focus()}
      }
    });
    subLinks(item).forEach(function(a,idx){
      a.addEventListener('keydown',function(e){
        var links=subLinks(item);
        var tops=topLevel();
        var ti=tops.indexOf(b);
        if(e.key==='ArrowDown'){e.preventDefault();focusAt(links,idx+1)}
        else if(e.key==='ArrowUp'){e.preventDefault();focusAt(links,idx-1)}
        else if(e.key==='Home'){e.preventDefault();focusAt(links,0)}
        else if(e.key==='End'){e.preventDefault();focusAt(links,links.length-1)}
        else if(e.key==='Escape'){e.preventDefault();closeItem(item);b.focus()}
        else if(e.key==='ArrowRight'&&desktop()){
          e.preventDefault();closeItem(item);var next=tops[(ti+1)%tops.length];next.focus();
          var nextItem=next.closest('.nav-item');if(nextItem)openItem(nextItem);
        }else if(e.key==='ArrowLeft'&&desktop()){
          e.preventDefault();closeItem(item);var prev=tops[(ti-1+tops.length)%tops.length];prev.focus();
          var prevItem=prev.closest('.nav-item');if(prevItem)openItem(prevItem);
        }else if(e.key==='Tab'&&desktop()&&!e.shiftKey&&idx===links.length-1){
          closeItem(item);
        }else if(e.key==='Tab'&&desktop()&&e.shiftKey&&idx===0){
          closeItem(item);
        }
      });
    });
  });

  if(btn){
    btn.addEventListener('click',function(){setMenu(btn.getAttribute('aria-expanded')!=='true')});
  }
  nav.querySelectorAll('.links a').forEach(function(a){
    a.addEventListener('click',function(){setMenu(false)});
  });
  d.addEventListener('keydown',function(e){
    if(e.key!=='Escape'||e.defaultPrevented)return;
    if(nav.querySelector('.nav-item.is-open')){
      var open=nav.querySelector('.nav-item.is-open');
      var b=open.querySelector('.nav-btn');
      closeAll();
      if(b) b.focus();
      e.preventDefault();
      return;
    }
    if(nav.classList.contains('open')){setMenu(false);btn&&btn.focus()}
  });
  d.addEventListener('click',function(e){
    if(!nav.contains(e.target)){closeAll();if(nav.classList.contains('open'))setMenu(false)}
  });
  d.addEventListener('focusin',function(e){
    if(!nav.contains(e.target)) closeAll();
  });
  window.addEventListener('resize',function(){
    if(desktop()&&nav.classList.contains('open')) setMenu(false);
  });
}
/* count-up */
function count(el){var a=+el.dataset.from,b=+el.dataset.to;if(r){el.textContent=b;return}var t0=null;function f(t){t0=t0||t;var p=Math.min((t-t0)/1400,1);p=1-Math.pow(1-p,3);el.textContent=Math.round(a+(b-a)*p);if(p<1)requestAnimationFrame(f)}el.textContent=a;requestAnimationFrame(f)}
var els=d.querySelectorAll('.rv,.pstrip');
if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');e.target.querySelectorAll('[data-to]').forEach(count);e.target.querySelectorAll('.pstrip').forEach(function(p){p.classList.add('in')});io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -5% 0px'});
els.forEach(function(el){io.observe(el)});
})();
(function(){var d=document,a=d.querySelector('[data-form]'),p=d.getElementById('cf'),pc,f;if(!a||!p)return;
var U='https://api.leadconnectorhq.com/widget/form/eVb1O6MEIsLGy9wOXSXe',ID='inline-eVb1O6MEIsLGy9wOXSXe';
function warm(){if(pc)return;pc=1;['https://api.leadconnectorhq.com','https://link.msgsndr.com'].forEach(function(u){var l=d.createElement('link');l.rel='preconnect';l.href=u;d.head.appendChild(l)})}
a.addEventListener('pointerenter',warm);a.addEventListener('focus',warm);
a.addEventListener('click',function(e){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;e.preventDefault();
var o=a.getAttribute('aria-expanded')!=='true';a.setAttribute('aria-expanded',o);a.textContent=o?'Hide the contact form':'Open the contact form';
if(o){p.hidden=false;if(!f){f=d.createElement('iframe');f.id=ID;f.src=U;f.title='Contact form for Merrick Lee';f.setAttribute('data-form-id','eVb1O6MEIsLGy9wOXSXe');f.onload=function(){p.classList.add('ok')};p.querySelector('.cf-in').appendChild(f);
var s=d.createElement('script');s.src='https://link.msgsndr.com/js/form_embed.js';s.async=true;d.body.appendChild(s)}
requestAnimationFrame(function(){requestAnimationFrame(function(){p.classList.add('open')})})}
else{p.classList.remove('open');setTimeout(function(){if(!p.classList.contains('open'))p.hidden=true},matchMedia('(prefers-reduced-motion: reduce)').matches?0:400)}})})();
(function(){var d=document;if(d.getElementById('lc-root')||d.querySelector('script[src="/assets/liora-chat.js"]'))return;
var s=d.createElement('script');s.src='/assets/liora-chat.js';s.defer=true;d.body.appendChild(s)})();

(function(){var d=document,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
var pics=d.querySelectorAll('.hero .pic img.kb');
var n=pics.length;
function hydrateHeroSlides(){
  d.querySelectorAll('.hero .pic source[data-srcset]').forEach(function(s){
    s.setAttribute('srcset', s.getAttribute('data-srcset'));
    s.removeAttribute('data-srcset');
  });
  for(var i=1;i<pics.length;i++){
    var img=pics[i], ss=img.getAttribute('data-srcset'), src=img.getAttribute('data-src');
    if(ss){img.setAttribute('srcset', ss);img.removeAttribute('data-srcset')}
    if(src){img.setAttribute('src', src);img.removeAttribute('data-src')}
  }
}
if(n<2||reduced)return;
var freeze=d.createElement('style');
freeze.setAttribute('data-hero-kb-freeze','1');
freeze.textContent='.hero .pic .kb{animation:none!important;opacity:0}.hero .pic .k1{opacity:1!important}';
d.head.appendChild(freeze);
function startCycle(){
  var slot=4,fade=0.96,cycle=n*slot;
  var pIn=(fade/cycle)*100,pHold=(slot/cycle)*100,pOut=((slot+fade)/cycle)*100,pBack=100-pIn;
  var css='.hero .pic .kb{animation-duration:'+cycle+'s}'
    +'@keyframes kb{0%{opacity:0;transform:scale(1)}'+pIn.toFixed(3)+'%{opacity:1}'+pHold.toFixed(3)+'%{opacity:1}'+pOut.toFixed(3)+'%{opacity:0;transform:scale(1.08)}100%{opacity:0}}'
    +'@keyframes kb1{0%{opacity:1;transform:scale(1)}'+pHold.toFixed(3)+'%{opacity:1}'+pOut.toFixed(3)+'%{opacity:0;transform:scale(1.08)}'+pBack.toFixed(3)+'%{opacity:0;transform:scale(1)}100%{opacity:1}}';
  var s=d.createElement('style');s.setAttribute('data-hero-kb','1');s.textContent=css;d.head.appendChild(s);
  for(var i=0;i<n;i++)pics[i].style.animationDelay=(i*slot)+'s';
}
setTimeout(function(){
  hydrateHeroSlides();
  if(freeze.parentNode)freeze.parentNode.removeChild(freeze);
  startCycle();
},5000)})();
