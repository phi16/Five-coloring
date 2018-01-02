window.oncontextmenu = _=>{
  return false;
};
window.addEventListener("load",_=>{
  const cvs = document.getElementById("canvas");
  const ctx = cvs.getContext("2d");
  const R = {
    circle: (p,r)=>{
      ctx.moveTo(p.x+r,p.y);
      ctx.arc(p.x,p.y,r,0,Math.PI*2,true);
    },
    lineRad: (a,b,rb,ra)=>{
      let p = {x: a.x, y: a.y};
      let q = {x: b.x, y: b.y};
      let dx = q.x - p.x;
      let dy = q.y - p.y;
      let le = Math.sqrt(dx*dx+dy*dy);
      if(le < ra + rb) return;
      dx /= le;
      dy /= le;
      q.x -= dx * ra;
      q.y -= dy * ra;
      p.x += dx * rb;
      p.y += dy * rb;
      ctx.moveTo(q.x,q.y);
      ctx.lineTo(p.x,p.y);
    },
    point: (p)=>{
      R.circle(p,2.5);
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
  let mouseGen = null;
  window.addEventListener("mousemove",e=>{
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouseSnap();
    if(mouseGen) mouseGen.next(true);
    else if(makeEdge) safeCheck();
  });
  window.addEventListener("mousedown",e=>{
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if(e.button == 2) {
      onPressRight();
      return;
    }
    mouseSnap();
    mouseGen = mouseHandler();
    mouseGen.next();
  });
  window.addEventListener("mouseup",e=>{
    if(e.button == 2) {
      onReleaseRight();
      return;
    }
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

  let vertices = new Set(); // Set {x:R,y:R,proxy:false,neighbor:Set Vertex,state:State}

  let proxyChanged = false;
  const onPressRight = _=>{
    proxyChanged = false;
    if(mouseTarget) {
      mouseTarget.proxy = !mouseTarget.proxy;
      proxyChanged = true;
      safeCheck();
      resetColoring();
    }
  };

  const onReleaseRight = _=>{
    if(proxyChanged) startColoring();
  };
  const mouseMot = {x:0,y:0};
  let mouseTarget = null;
  const mouseTo = {x:0,y:0};
  let removeC = false;
  const mouseSnap = _=>{
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
    // proxy should have exactly 2 neighbors
    vertices.forEach(v=>{
      if(v.proxy && v.neighbor.size!=2) {
        safe = false;
      }
    });

    let s = v=>v.proxy ? 5 : 15;
    // vertex overlapping
    withTraverse(vertices,_=>{
      vertices.forEach(v1=>{
        v1.traversed = true;
        vertices.forEach(v2=>{
          if(v2.traversed) return;
          if(dist(v1,v2) < s(v1)+s(v2)) {
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
          if(distLinePoint(v1,v2,v) < s(v)+5) {
            safe = false;
          }
        });
      });
      if(makeEdge && v1!=mouseTarget && v1!=edgeEnd && distLinePoint(edgeEnd,mouseMot,v1) < s(v1)+5) {
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

  const mouseHandler = function*(){
    if(!mouseTarget) {
      resetColoring();
      // Create a vertex
      const v = {
        x: mouse.x,
        y: mouse.y,
        neighbor: new Set(),
        state: null,
        proxy: false
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
      startColoring();
    } else {
      // Move a vertex, or Draw an edge
      let v = mouseTarget;
      if(makeEdge) {
        resetColoring();
        if(removeC) {
          // Remove a vertex
          v.neighbor.forEach(n=>{
            n.neighbor.delete(v);
          })
          vertices.delete(v);
          removeC = false;
          makeEdge = false;
        } else {
          // Draw an edge
          edgeEnd.neighbor.add(v);
          v.neighbor.add(edgeEnd);
          makeEdge = false;
        }
        safeCheck();
        startColoring();
      } else {
        let moved = false;
        while(yield) {
          v.x = mouse.x;
          v.y = mouse.y;
          moved = true;
          safeCheck();
        }
        if(!moved) {
          // Drawing an edge
          edgeEnd = v;
          makeEdge = true;
          removeC = true; // may want to remove the vertex
        }
        safeCheck();
        if(!coloringGen) startColoring();
      }
    }
  };

  let blackFrame = false;
  let blackCenter = null;
  let coloringGen = null;
  const resetColoring = _=>{
    vertices.forEach(v=>{
      v.state = null;
      blackFrame = false;
    });
    coloringGen = null;
  };
  const startColoring = _=>{
    if(!safe) return;
    coloringGen = coloringHandler();
  };
  const coloringHandler = function*(){
    let verts = new Set();
    vertices.forEach(v=>{
      if(!v.proxy) verts.add(v);
    });
    function neighbors(v) {
      let s = new Set();
      function traverse(v,n,f) {
        if(n.proxy) {
          n.neighbor.forEach(nn=>{
            if(nn!=v) traverse(n,nn,f);
          });
        } else {
          f(n);
        }
      }
      v.neighbor.forEach(n=>{
        traverse(v,n,e=>{
          if(e.state.name != "Reduce") s.add(n);
        });
      });
      return s;
    }
    function startChain(v) {
      blackFrame = true;
      blackCenter = v;
    }
    function endChain() {
      blackFrame = false;
    }
    function resetChain() {
      vertices.forEach(v=>{
        v.state.chain = new Set();
      });
      blackCenter = null;
    }
    function* trace(v,n) {
      v.state.chain.add({target:n,color:255});
      yield* wait(20);
      if(n.proxy) {
        for(let nn of neighbors(n)) {
          if(v != nn) {
            return yield* trace(n,nn);
          }
        }
      } else {
        return n;
      }
    }
    function* wait(d) {
      for(let i=0;i<d;i++) {
        verts.forEach(v=>{
          let n = v.state.name;
          let c = v.state.color;
          let to = [0,0,0,1];
          if(n == "Wait") to = [128,128,128,1];
          if(n == "Reduce") to = [128,128,128,0];
          if(n == 0) to = [228,141,10,1];
          if(n == 1) to = [249,19,179,1];
          if(n == 2) to = [149,58,248,1];
          if(n == 3) to = [32,94,236,1];
          if(n == 4) to = [17,219,143,1];
          for(let j=0;j<4;j++) {
            c[j] += (to[j] - c[j]) / 4;
          }
        });
        vertices.forEach(v=>{
          if(!v.state) return;
          if(blackCenter == v) {
            let to = !blackFrame ? 255 : 0;
            v.state.frame += (to - v.state.frame) / 4;
          }
          v.state.chain.forEach(c=>{
            let to = !blackFrame ? 255 : v.state.frame;
            c.target.state.frame += (to - c.target.state.frame) / 4;
            c.color += (to - c.color) / 4;
          });
        });
        yield;
      }
    }
    function* reduce() {
      // in 4-coloring situation,
      // "V" will be a graph...
      let minV = null;
      let minC = -1;
      verts.forEach(v=>{
        if(v.state.name != "Wait") return;
        let c = neighbors(v).size;
        if(minV==null || c<minC) {
          minV = v;
          minC = c;
        }
      });
      if(!minV) return;
      minV.state.name = "Reduce";
      console.log(minC);
      yield* wait(10);
      yield* reduce();
      let colors = {0:false, 1:false, 2:false, 3:false, 4:false};
      startChain(minV);
      for(let n of neighbors(minV)) {
        yield* wait(10);
        let rn = yield* trace(minV,n);
        colors[rn.state.name] = true;
      }
      yield* wait(20);
      let choices = [];
      for(let i=0;i<5;i++) {
        if(!colors[i]) choices.push(i);
      }
      if(choices.length == 0) {
        // TODO: degree five
        console.log("yabai");
      } else {
        let index = 0; //Math.floor(Math.random()*choices.length);
        minV.state.name = choices[index];
      }
      endChain();
      yield* wait(30);
      resetChain();
    }
    vertices.forEach(v=>{
      v.state = {
        name: "Wait",
        color: [128,128,128,1],
        black: false,
        frame: 255,
        chain: new Set()
      };
    });
    yield* wait(100);
    yield* reduce();
  };

  const render = _=>{
    if(coloringGen) coloringGen.next();

    ctx.clearRect(0,0,cvs.width,cvs.height);
    ctx.lineCap = "round";

    // bg
    vertices.forEach(v=>{
      if(v.proxy) return;
      let c = v.state ? v.state.color : [128,128,128,1];
      c = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), c[3]];
      ctx.fillStyle="rgba(" + c.join(",") + ")";
      ctx.beginPath();
      R.circle(v,15);
      ctx.fill();
    });

    // frame
    ctx.shadowColor = safe ? "rgba(0,0,0,1)" : "rgba(255,0,0,1)"
    ctx.shadowBlur = 4;
    // white
    ctx.strokeStyle="rgba(255,255,255,1)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    vertices.forEach(v=>{
      if(!v.proxy) {
        R.circle(v,12.5);
      } else {
        R.point(v);
      }
    });
    withTraverse(vertices,_=>{
      vertices.forEach(v=>{
        v.neighbor.forEach(n=>{
          if(n.traversed) return;
          R.lineRad(v,n,v.proxy?5:15,n.proxy?5:15);
        });
        v.traversed = true;
      });
    });
    if(makeEdge) {
      R.lineRad(edgeEnd,mouseMot,edgeEnd.proxy?5:15,0);
    }
    ctx.stroke();
    // black
    vertices.forEach(v=>{
      if(!v.state || Math.abs(v.state.frame-255)<1) return;
      let b = Math.round(v.state.frame);
      ctx.strokeStyle="rgba(" + [b,b,b].join(",") + ",1)";
      ctx.beginPath();
      if(!v.proxy) {
        R.circle(v,12.5);
      } else {
        R.point(v);
      }
      ctx.stroke();
    });
    vertices.forEach(v=>{
      if(!v.state || Math.abs(v.state.frame-255)<1) return;
      v.state.chain.forEach(c=>{
        let n = c.target;
        if(!n.state || Math.abs(n.state.frame-255)<1) return;
        let b = Math.round(c.color);
        ctx.strokeStyle="rgba(" + [b,b,b].join(",") + ",1)";
        ctx.beginPath();
        R.lineRad(v,n,v.proxy?5:15,n.proxy?5:15);
        ctx.stroke();
      });
      v.traversed = true;
    });
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
