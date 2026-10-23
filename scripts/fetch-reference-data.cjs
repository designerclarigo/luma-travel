const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../src/constants/data');
fs.mkdirSync(directory, {recursive:true});
async function read(url, json=true) { const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`${response.status} from ${new URL(url).hostname}`);return json?response.json():response.text(); }
async function main() {
  const world=await read('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
  const features=world.features.map(f=>({type:'Feature',properties:{code:f.properties.ISO_A2_EH||f.properties.ISO_A2,name:f.properties.NAME_EN||f.properties.ADMIN,iso3:f.properties.ADM0_A3},geometry:f.geometry}));
  fs.writeFileSync(path.join(directory,'world.json'),JSON.stringify({type:'FeatureCollection',features}));console.log(`World geometry: ${features.length} features`);
  const csv=await read('https://raw.githubusercontent.com/datasets/country-list/main/data.csv',false);
  const countries=csv.trim().split(/\r?\n/).slice(1).map(line=>{const match=line.match(/^(.*),([A-Z]{2})$/);if(!match)throw Error('Unexpected country CSV');return {code:match[2],name:match[1].replace(/^"|"$/g,'').replace(/""/g,'"')};});
  if(countries.length<240)throw Error('Incomplete country list');fs.writeFileSync(path.join(directory,'countries.json'),JSON.stringify(countries));console.log(`Country records: ${countries.length}`);
  const places=[['bali',-8.65,115.2167,'Asia/Makassar'],['braies',46.6945,12.0856,'Europe/Rome'],['santorini',36.4618,25.3753,'Europe/Athens'],['kyoto',35.0116,135.7681,'Asia/Tokyo'],['maldives',4.1755,73.5093,'Indian/Maldives']];
  const normals=JSON.parse(fs.readFileSync(path.join(directory,'climate.json'),'utf8')).filter(r=>r.months.every(m=>Number.isFinite(m.low)&&Number.isFinite(m.high)&&m.samples>=700));
  for(const [placeId,latitude,longitude,timezone] of places){
    if(normals.some(r=>r.placeId===placeId)){console.log('Climate already verified: '+placeId);continue;}
    try{
      const url=new URL('https://archive-api.open-meteo.com/v1/archive');for(const [key,value]of Object.entries({latitude,longitude,start_date:'1991-01-01',end_date:'2020-12-31',daily:'temperature_2m_min,temperature_2m_max,precipitation_sum',models:'era5',timezone}))url.searchParams.set(key,String(value));
      const result=await read(url);const d=result.daily;if(!d||d.time.length<10000)throw Error('Insufficient climate observations');
      const months=Array.from({length:12},(_,i)=>{const indices=d.time.map((date,index)=>date.slice(5,7)===String(i+1).padStart(2,'0')?index:-1).filter(index=>index>=0&&Number.isFinite(d.temperature_2m_min[index])&&Number.isFinite(d.temperature_2m_max[index])&&Number.isFinite(d.precipitation_sum[index]));const average=key=>indices.reduce((sum,index)=>sum+d[key][index],0)/indices.length;return {month:i+1,low:Math.round(average('temperature_2m_min')*10)/10,high:Math.round(average('temperature_2m_max')*10)/10,rainDays:Math.round(indices.filter(index=>d.precipitation_sum[index]>=1).length/30*10)/10,samples:indices.length};});
      if(months.some(m=>m.samples<700||!Number.isFinite(m.low)||!Number.isFinite(m.high)))throw Error('Incomplete monthly data; no climate record saved');
      normals.push({placeId,latitude,longitude,timezone,period:'1991–2020',model:'ERA5',source:'Open-Meteo historical reanalysis',retrievedAt:new Date().toISOString(),url:url.toString(),months});fs.writeFileSync(path.join(directory,'climate.json'),JSON.stringify(normals));console.log(`Climate normals: ${placeId}, ${d.time.length} days`);
    }catch(error){console.log(`Climate unavailable: ${placeId}: ${error.message}`);}
  }
  fs.writeFileSync(path.join(directory,'climate.json'),JSON.stringify(normals));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
