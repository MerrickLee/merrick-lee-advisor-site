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
