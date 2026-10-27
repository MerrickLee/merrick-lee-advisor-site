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
/* mobile menu */
var nav=d.querySelector('.site-nav'),btn=nav&&nav.querySelector('.menu-toggle');
if(btn){var set=function(o){nav.classList.toggle('open',o);btn.setAttribute('aria-expanded',o);btn.querySelector('.mt-label').textContent=o?'Close':'Menu'};
 btn.addEventListener('click',function(){set(btn.getAttribute('aria-expanded')!=='true')});
 nav.querySelectorAll('.links a').forEach(function(a){a.addEventListener('click',function(){set(false)})});
 d.addEventListener('keydown',function(e){if(e.key==='Escape'&&nav.classList.contains('open')){set(false);btn.focus()}});
 d.addEventListener('click',function(e){if(nav.classList.contains('open')&&!nav.contains(e.target))set(false)});}
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
