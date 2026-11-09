import * as THREE from 'three';
// Fiat Punto 176: rounded hatch, teardrop headlights, high rear pillar lamps.
export function buildPuntoBody({body,paint,black,glass,metal,light,brakeMat,add,profile,colored,cylinder}){
 glass.transparent=true;glass.opacity=.70;glass.depthWrite=false;
 const outline=[[-1.88,.10],[-1.88,.48],[-1.6,.65],[-.85,.73],[.62,.69],[1.46,.60],[1.88,.55],[1.88,.10],[1.60,.10]];
 for(let i=0;i<=10;i++){const a=i*Math.PI/10;outline.push([1.225+.375*Math.cos(a),.375*Math.sin(a)]);}outline.push([-.85,.10]);
 for(let i=0;i<=10;i++){const a=i*Math.PI/10;outline.push([-1.225+.375*Math.cos(a),.375*Math.sin(a)]);}outline.push([-1.88,.10]);
 profile(1.60,outline,paint);
 profile(1.43,[[.72,.65],[.54,.82],[.10,1.13],[-.65,1.17],[-1.50,1.06],[-1.83,.64]],glass);
 profile(1.46,[[.10,1.14],[-.65,1.18],[-1.50,1.07],[-1.52,1.01],[-.65,1.12],[.10,1.08]],paint);
 // Thin window pillars, door handles and the marked wheel-arch lips.
 for(const side of [-1,1]){
  const a=add([.055,.51,.065],[side*.73,.91,.34]);a.rotation.x=-.48;
  add([.065,.48,.07],[side*.732,.92,-.47],black);
  const c=add([.095,.56,.08],[side*.724,.82,-1.65]);c.rotation.x=.48;
  add([.11,.035,2.0],[side*.806,.45,-.10],black);add([.09,.055,.22],[side*.813,.64,-.30],black);
  add([.15,.105,.25],[side*.86,.78,.56],paint);
  for(const z of [-1.225,1.225]){
   const shape=new THREE.Shape();for(let i=0;i<=14;i++){const a=i*Math.PI/14,x=z+.405*Math.cos(a),y=.405*Math.sin(a);if(i)shape.lineTo(-x,y);else shape.moveTo(-x,y);}for(let i=14;i>=0;i--){const a=i*Math.PI/14;shape.lineTo(-(z+.373*Math.cos(a)),.373*Math.sin(a));}shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false});g.rotateY(Math.PI/2);g.translate(side*.805-(side<0?.035:0),0,0);body.add(new THREE.Mesh(g,paint));
  }
  const lens=profile(.145,[[-1.50,1.045],[-1.60,1.045],[-1.88,.51],[-1.78,.51]],brakeMat);lens.position.x=side*.719;
  const amber=colored([.14,.09,.04],[side*.72,.75,-1.65],'#d69135');amber.rotation.x=.72;
  const reverse=colored([.14,.065,.04],[side*.72,.63,-1.77],'#eee7cf');reverse.rotation.x=.72;
 }
 profile(1.61,[[1.89,.12],[1.89,.32],[1.68,.39],[1.63,.22]],black);
 profile(1.61,[[-1.90,.10],[-1.90,.31],[-1.70,.37],[-1.70,.20]],black);
 add([.75,.13,.035],[0,.35,1.892],black);
 // Pointed lenses drawn as actual polygon silhouettes, not rectangular blocks.
 for(const side of [-1,1]){
  const vertices=[[.29,.43,1.895],[.58,.42,1.895],[.76,.46,1.895],[.71,.57,1.75],[.47,.56,1.82]],p=[],colors=[],c=new THREE.Color('#f4edd2');for(let i=1;i<vertices.length-1;i++)for(const j of side>0?[0,i,i+1]:[0,i+1,i]){const v=vertices[j];p.push(v[0]*side,v[1],v[2]);c.toArray(colors,colors.length);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.length/3*2),2));g.computeVertexNormals();body.add(new THREE.Mesh(g,light));
 }
 colored([.09,.06,.025],[0,.60,1.48],'#a9b5c0');colored([.13,.045,.025],[-.45,.57,-1.89],'#d4d9d5');
 add([1.13,.075,.11],[0,.78,-1.64],paint);add([.45,.035,.035],[0,.64,-1.885],black);
 // Seats, rear bench, dashboard and left-hand steering wheel.
 for(const x of [-.35,.35]){add([.47,.13,.49],[x,.49,-.15],black);const back=add([.46,.47,.12],[x,.75,-.43],black);back.rotation.x=-.12;add([.27,.16,.11],[x,1.02,-.43],black);}
 add([1.13,.35,.39],[0,.64,-.99],black);add([1.24,.15,.34],[0,.66,.57],black);cylinder(.14,.035,[-.37,.84,.43],black,'z',12);
 const antenna=add([.015,.30,.015],[0,1.29,-.68],black);antenna.rotation.x=-.30;
 body.userData.punto={generation:'176',verticalRearLamps:2,teardropHeadlights:2,alloySpokes:10,interior:true};
}
