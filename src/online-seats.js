import {installAnimatedAvatar} from './animated-avatar.js';
import {appearanceSignature,normalizeAppearance} from './avatar-appearance.js';
import {makePerson} from './actors.js';

const crews=new WeakMap();
export function showPassengers(root,kind,count,{members=[],appearances,renderer}={}){
 let people=crews.get(root);
 if(!people){
  if(!count)return;
  people=[];crews.set(root,people);
 }
 while(people.length<count){
  const passenger=makePerson(root);
  const i=people.length;
  passenger.root.scale.setScalar(.68);
  if(kind==='rambo'){
   passenger.root.position.set(i===4?0:i%2?.44:-.44,.85,i===4?-1.64:i<2?-.32:-.98);
  }else{
   passenger.root.position.set(i===0?.4:i===1?-.42:.42,.42,i===0?.28:-.55);
  }
  passenger.limbs.forEach((limb,j)=>{if(j>=2)limb.rotation.x=-1.25;});
  passenger.animateAvatar=installAnimatedAvatar(passenger,'male');people.push(passenger);
 }
 people.forEach((person,i)=>{person.root.visible=i<count;if(i>=count)return;const appearance=normalizeAppearance(appearances?.get(members[i])),signature=appearanceSignature(appearance);if(person.appearanceSignature!==signature){person.appearanceSignature=signature;person.animateAvatar.customize(appearance,renderer).catch(console.warn);}person.animateAvatar(0,0,false);person.animateAvatar.seat();});
}

export function nearestDriver(room,person){
 let slot=null,nearest=6;
 for(const [id,[kind,x,y,z,,speed]] of room?.poses??[]){
  const distance=Math.hypot(person.x-x,person.root.position.y-y,person.z-z);
  if(kind!=='foot'&&(kind!=='helicopter'||y-person.root.position.y<=2)&&Math.abs(speed)<=3&&distance<nearest){slot=id;nearest=distance;}
 }
 return slot;
}
