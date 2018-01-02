window.addEventListener("load",_=>{
  const cvs = document.getElementById("canvas");
  const ctx = cvs.getContext("2d");
  const R = {
    circle: (p,r)=>{
      ctx.moveTo(p.x+r,p.y);
      ctx.arc(p.x,p.y,r,0,Math.PI*2,true);
    },
    lineRad: (a,b,r)=>{
      let p = {x: a.x, y: a.y};
      let q = {x: b.x, y: b.y};
      let dx = q.x - p.x;
      let dy = q.y - p.y;
      let le = Math.sqrt(dx*dx+dy*dy);
      if(le < r) return;
      dx /= le;
      dy /= le;
      q.x -= dx * r;
      q.y -= dy * r;
      p.x += dx * r;
      p.y += dy * r;
      ctx.moveTo(q.x,q.y);
      ctx.lineTo(p.x,p.y);
    }
  };
  const resize = _=>{
    const w = document.getElementById("container").clientWidth;
    const h = document.getElementById("container").clientHeight;
    cvs.width = w;
    cvs.height = h;
  }
  resize();
  window.addEventListener("resize",resize);

  const mouse = {x:0,y:0};
  let mouseSnap = _=>_;
  let mouseHandler = function*(){};
  let mouseGen = null;
  window.addEventListener("mousemove",e=>{
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouseSnap();
    if(mouseGen) mouseGen.next(true);
    else if(makeEdge) safeCheck(); // backward reference :(
  });
  window.addEventListener("mousedown",e=>{
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouseSnap();
    mouseGen = mouseHandler();
    mouseGen.next();
  });
  window.addEventListener("mouseup",_=>{
    mouseGen.next(false);
    mouseGen = null;
  });

  const withTraverse = (s,f)=>{
    s.forEach(e=>{
      e.traversed = false;
    });
    f();
    s.forEach(e=>{
      delete e.traversed;
    });
  };
  const dist = (p,q)=>{
    return Math.sqrt(Math.pow(p.x-q.x,2) + Math.pow(p.y-q.y,2));
  };
  const distLinePoint = (a,b,p)=>{
    // ref: https://qiita.com/yellow_73/items/bcd4e150e7caa0210ee6
    let d = dist(a,b);
    let t = (b.x-a.x)*(p.x-a.x) + (b.y-a.y)*(p.y-a.y);
    if(t<0)   return dist(a,p);
    if(t>d*d) return dist(b,p);
    let f = (b.x-a.x)*(p.y-a.y) - (b.y-a.y)*(p.x-a.x);
    return Math.abs(f)/d;
  };
  const distLineLine = (a1,b1,a2,b2)=>{
    // ref: https://tgws.plus/ul/ul31.html
    let oa2 = (b1.x-a1.x)*(a2.y-a1.y) - (b1.y-a1.y)*(a2.x-a1.x);
    let ob2 = (b1.x-a1.x)*(b2.y-a1.y) - (b1.y-a1.y)*(b2.x-a1.x);
    let oa1 = (b2.x-a2.x)*(a1.y-a2.y) - (b2.y-a2.y)*(a1.x-a2.x);
    let ob1 = (b2.x-a2.x)*(b1.y-a2.y) - (b2.y-a2.y)*(b1.x-a2.x);
    if(oa2*ob2 < 0 && oa1*ob1 < 0) return 0;
    return Math.min(
      distLinePoint(a1,b1,a2),
      distLinePoint(a1,b1,b2),
      distLinePoint(a2,b2,a1),
      distLinePoint(a2,b2,b1)
    );
  };

  let vertices = new Set(); // Set {x:R,y:R,neighbor:Set Vertex}

  const mouseMot = {x:0,y:0};
  let mouseTarget = null;
  const mouseTo = {x:0,y:0};
  let removeC = false;
  mouseSnap = _=>{
    let nv = null;
    let nd = -1;
    vertices.forEach(v=>{
      let d = dist(v,mouse);
      if(nd<0 || d<nd) {
        nv = v;
        nd = d;
      }
    });
    // TODO: edge
    if(nv && nd<20) {
      if(mouseTarget != nv) removeC = false;
      mouseTarget = nv;
      mouseTo.x = nv.x;
      mouseTo.y = nv.y;
    } else {
      mouseTarget = null;
      mouseTo.x = mouse.x;
      mouseTo.y = mouse.y;
      removeC = false;
    }
  };

  let edgeEnd = null;
  let makeEdge = false;

  let safe = true;
  let safeCheck = _=>{
    safe = true;
    // vertex overlapping
    withTraverse(vertices,_=>{
      vertices.forEach(v1=>{
        v1.traversed = true;
        vertices.forEach(v2=>{
          if(v2.traversed) return;
          if(dist(v1,v2) < 15+15) {
            safe = false;
          }
        });
      });
    });
    if(!safe) return;
    vertices.forEach(v1=>{
      v1.traversed = true;
      v1.neighbor.forEach(v2=>{
        vertices.forEach(v=>{
          if(v1==v || v2==v) return;
          if(distLinePoint(v1,v2,v) < 15+5) {
            safe = false;
          }
        });
      });
      if(makeEdge && v1!=mouseTarget && v1!=edgeEnd && distLinePoint(edgeEnd,mouseMot,v1) < 15+5) {
        safe = false;
      }
    });
    if(!safe) return;
    // edge overlapping
    withTraverse(vertices,_=>{
      vertices.forEach(v1=>{
        v1.traversed = true;
        v1.neighbor.forEach(n1=>{
          vertices.forEach(v2=>{
            if(v2.traversed) return;
            v2.neighbor.forEach(n2=>{
              if(n2.traversed || n1==v2 || n1==n2) return;
              if(distLineLine(v1,n1,v2,n2) < 5+5) {
                safe = false;
              }
            });
          });
          if(makeEdge && v1!=edgeEnd && n1!=edgeEnd && v1!=mouseTarget && n1!=mouseTarget) {
            if(distLineLine(v1,n1,edgeEnd,mouseMot) < 5+5) {
              safe = false;
            }
          }
        });
      });
    });
  };

  mouseHandler = function*(){
    if(!mouseTarget) {
      // Create a vertex
      const v = {
        x: mouse.x,
        y: mouse.y,
        neighbor: new Set()
      };
      vertices.add(v);
      if(makeEdge) {
        edgeEnd.neighbor.add(v);
        v.neighbor.add(edgeEnd);
        makeEdge = false;
      }
      safeCheck();
      while(yield) {
        v.x = mouse.x;
        v.y = mouse.y;
        safeCheck();
      }
    } else {
      // Move a vertex, or Draw a edge
      let v = mouseTarget;
      if(makeEdge) {
        if(removeC) {
          // Remove a vertex
          v.neighbor.forEach(n=>{
            n.neighbor.delete(v);
          })
          vertices.delete(v);
          removeC = false;
          makeEdge = false;
        } else {
          edgeEnd.neighbor.add(v);
          v.neighbor.add(edgeEnd);
          makeEdge = false;
        }
        safeCheck();
      } else {
        let moved = false;
        while(yield) {
          v.x = mouse.x;
          v.y = mouse.y;
          moved = true;
          safeCheck();
        }
        if(!moved) {
          // Drawing a edge
          edgeEnd = v;
          makeEdge = true;
          removeC = true; // may want to remove the vertex
        }
        safeCheck();
      }
    }
  };

  const render = _=>{
    ctx.clearRect(0,0,cvs.width,cvs.height);

    // bg
    vertices.forEach(v=>{
      ctx.fillStyle="rgba(128,128,128,1)";
      ctx.beginPath();
      R.circle(v,15);
      ctx.fill();
    });

    // frame
    ctx.shadowColor = safe ? "rgba(0,0,0,1)" : "rgba(255,0,0,1)"
    ctx.shadowBlur = 4;
    ctx.strokeStyle="rgba(255,255,255,1)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    vertices.forEach(v=>{
      R.circle(v,12.5);
    });
    withTraverse(vertices,_=>{
      vertices.forEach(v=>{
        v.neighbor.forEach(n=>{
          if(n.traversed) return;
          R.lineRad(v,n,10);
        });
        v.traversed = true;
      });
    });
    if(makeEdge) {
      R.lineRad(edgeEnd,mouseMot,10);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // mouse
    mouseMot.x += (mouseTo.x - mouseMot.x) / 2;
    mouseMot.y += (mouseTo.y - mouseMot.y) / 2;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    R.circle(mouseMot,10);
    ctx.stroke();

    requestAnimationFrame(render);
  };
  render();
});
