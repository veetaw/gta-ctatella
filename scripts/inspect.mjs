import * as s from 'shapefile';import {fromFile} from 'geotiff';
for(const n of ['EDIFC_CR_EDF_ME','EDIFC_CR_EDF_IS','EL_STR','EL_STR_EL_STR_TRA_SG','AC_VEI_AC_VEI_SUP_SR','TP_STR_TP_STR_TRA','TR_STR_TR_STR_TRA_SG']){try{const r=await s.open(`assets/DBT_5K/DBT/${n}.shp`);let f=await r.read(); console.log(n,JSON.stringify(f.value).slice(0,1600));}catch(e){console.log(n,e.message)}}
for(const n of ['EDIFC','EDIFC_EDIFC_USO','TP_STR','TR_STR']){try{const r=await s.openDbf(`assets/DBT_5K/DBT/${n}.dbf`,{encoding:'windows-1252'});console.log(n,(await r.read()).value)}catch(e){console.log(e.message)}}
const t=await fromFile('assets/images-fcbaf2ic96/469092.tif');const im=await t.getImage();console.log('TIFF',im.getWidth(),im.getHeight(),im.getBoundingBox(),im.getGeoKeys());
