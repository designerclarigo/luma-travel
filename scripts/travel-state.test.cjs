const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: require('./test-support.cjs').load('src/lib/travel-state.ts') };
const { createTravelStore, parseTravelState, filterDestinations, defaultFilters, validDeparture, createTrip } = scope.exports;
const { addDays, tripDays, sortDestinations, rememberSearch, validateTrip, saveTrip, markNotificationsRead } = scope.exports;
const memory = (initial = null) => { let raw = initial; return { getItem: async () => raw, setItem: async (_, value) => { raw = value; } }; };
const places = [
  { name:'Bali', country:'Indonesia', region:'Island', keywords:'villa stays retreat', categories:['Nature','Beaches'], price:180, rating:4.9 },
  { name:'Kyoto', country:'Japan', region:'Gardens', keywords:'tea ryokan experiences', categories:['Cities','Nature'], price:240, rating:4.9 },
  { name:'Santorini', country:'Greece', region:'Island', keywords:'sunset', categories:['Beaches'], price:280, rating:4.8 },
];
test('fresh travel storage starts with an empty collection and no plans', async () => {
  const value = await createTravelStore(memory()).load(); assert.equal(value.saved.length, 0); assert.equal(value.trips.length, 0);
});
test('search matches destination, country, stays and experiences across multiple words', () => {
  assert.equal(filterDestinations(places, '  JAPAN tea ', defaultFilters)[0].name, 'Kyoto');
  assert.equal(filterDestinations(places, 'villa stays', defaultFilters)[0].name, 'Bali');
  assert.equal(filterDestinations(places, 'no such place', defaultFilters).length, 0);
});
test('category, budget and rating filters combine correctly', () => {
  assert.equal(filterDestinations(places, '', {category:'Beaches',budget:200,highlyRated:true}).length, 1);
  assert.equal(filterDestinations(places, '', {category:'Cities',budget:200,highlyRated:false}).length, 0);
  assert.equal(filterDestinations(places, '', {category:'Beaches',budget:null,highlyRated:true})[0].name, 'Bali');
});
test('saved places survive a new store instance', async () => {
  const disk = memory(); const store = createTravelStore(disk); await store.load();
  await store.update(value => ({...value,saved:['bali']}));
  assert.equal((await createTravelStore(disk).load()).saved[0], 'bali');
});
test('20 queued bookmark updates keep every distinct destination', async () => {
  const store = createTravelStore(memory()); await store.load();
  const results = await Promise.all(Array.from({length:20}, (_,index) => store.update(value => ({...value,saved:[...value.saved,String(index)]}))));
  assert.equal(results.at(-1).saved.length, 20);
});
test('a failed write does not enter durable state or prevent the next change', async () => {
  let attempts = 0; const disk = memory(); const store = createTravelStore({getItem:disk.getItem,setItem:async (...args) => {if(++attempts===1)throw Error('disk unavailable');await disk.setItem(...args);}}); await store.load();
  const failed = store.update(value => ({...value,saved:['bali']}));
  const next = store.update(value => ({...value,saved:[...value.saved,'kyoto']}));
  await assert.rejects(failed,/disk unavailable/); assert.equal((await next).saved.join(','),'kyoto');
  assert.equal((await createTravelStore(disk).load()).saved.join(','),'kyoto');
});
test('corrupt saved data is rejected without overwrite', async () => {
  let writes = 0; const store = createTravelStore({getItem:async () => '{bad',setItem:async () => {writes++;}});
  await assert.rejects(store.load()); assert.equal(writes,0);
  assert.throws(() => parseTravelState('{"version":1,"saved":[]}'));
});
test('queued profile and trip edits preserve bookmarks', async () => {
  const store = createTravelStore(memory()); await store.load(); const trip = createTrip('bali','A Bali escape','2099-10-22');
  await Promise.all([store.update(v=>({...v,saved:['bali']})),store.update(v=>({...v,profile:{name:'Maya',location:'Pune, India'}})),store.update(v=>({...v,trips:[trip]}))]);
  const final = await store.update(v=>v); assert.equal(final.saved[0],'bali');assert.equal(final.profile.name,'Maya');assert.ok(final.trips[0].packing.length > 5);
});
test('departure dates reject overflow dates and accept leap days', () => {
  assert.equal(validDeparture('2028-02-29'),true);assert.equal(validDeparture('2026-02-30'),false);assert.equal(validDeparture('22/10/2026'),false);
});
test('trip creation validates names and past departure dates', () => {
  assert.throws(()=>createTrip('bali',' ','2099-10-22'),/trip name/);assert.throws(()=>createTrip('bali','Escape','2000-01-01'),/future/);
  const trip = createTrip('bali','  A little escape  ','2099-10-22');assert.equal(trip.title,'A little escape');assert.equal(trip.packing.every(item=>!item.packed),true);
});

test('version-one migration retains profile, bookmarks, trips and checked essentials', async () => {
  const legacy = {version:1,saved:['bali','bali'],profile:{name:'Maya',location:'Pune'},notificationsRead:true,trips:[{id:'original',destinationId:'bali',title:'My original trip',departure:'2030-04-20',packing:[{id:'passport',label:'Passport',packed:true}]}]};
  let writes=0;const disk=memory(JSON.stringify(legacy));const store=createTravelStore({getItem:disk.getItem,setItem:async(...args)=>{writes++;await disk.setItem(...args);}});
  const state=await store.load();assert.equal(writes,0);assert.equal(state.version,3);assert.equal(state.profile.name,'Maya');assert.equal(state.saved.join(','),'bali');assert.equal(state.trips[0].id,'original');assert.equal(state.trips[0].packing[0].packed,true);assert.equal(state.notifications[0].read,true);
  await store.update(v=>({...v,saved:[...v.saved,'kyoto']}));const reloaded=await createTravelStore(disk).load();assert.equal(reloaded.trips[0].packing[0].packed,true);assert.equal(reloaded.saved.join(','),'bali,kyoto');
});
test('sorting is stable and never mutates the catalog',()=>{assert.equal(sortDestinations(places,'price')[0].name,'Bali');assert.equal(sortDestinations(places,'rating')[0].name,'Bali');assert.equal(places[2].name,'Santorini');assert.equal(filterDestinations(places,'',{...defaultFilters,minRating:4.9}).length,2);});
test('recent searches are trimmed, deduplicated case-insensitively and bounded',()=>{let value=parseTravelState(null);for(let i=0;i<12;i++)value=rememberSearch(value,`Place ${i}`);value=rememberSearch(value,'  PLACE 11  ');assert.equal(value.recentSearches.length,8);assert.equal(value.recentSearches[0],'PLACE 11');assert.equal(rememberSearch(value,' ').recentSearches.length,8);});
test('calendar date arithmetic crosses month, leap-year and year boundaries',()=>{assert.equal(addDays('2028-02-28',2),'2028-03-01');assert.equal(addDays('2030-12-31',1),'2031-01-01');assert.equal(tripDays('2028-02-28','2028-03-01'),3);});
const entry=()=>({id:'activity-1',day:2,destinationId:'bali',title:'Garden walk',time:'09:00',notes:'Bring water',cost:25});
test('itinerary validation catches reversed dates, invalid party sizes, costs, time and orphan activities',()=>{const trip=createTrip('bali','Escape','2099-04-20');assert.equal(validateTrip(trip),null);assert.match(validateTrip({...trip,endDate:'2099-04-19'}),/return date/);assert.match(validateTrip({...trip,travelers:0}),/travelers/);assert.match(validateTrip({...trip,budget:NaN}),/budget/);assert.match(validateTrip({...trip,itinerary:[{...entry(),day:8}]}),/outside/);assert.match(validateTrip({...trip,itinerary:[{...entry(),destinationId:'kyoto'}]}),/removed/);assert.match(validateTrip({...trip,itinerary:[{...entry(),time:'25:00'}]}),/valid time/);assert.match(validateTrip({...trip,itinerary:[{...entry(),cost:-1}]}),/cost/);});
test('create, edit and delete a multi-destination itinerary durably without losing other data',async()=>{const disk=memory();const store=createTravelStore(disk);await store.load();const trip={...createTrip('bali','Two places','2099-04-20'),destinationIds:['bali','kyoto'],travelers:3,budget:2500,interests:['Culture'],itinerary:[entry(),{...entry(),id:'activity-2',day:3,destinationId:'kyoto',title:'Tea ceremony'}]};await store.update(v=>saveTrip({...v,saved:['bali']},trip));await store.update(v=>({...v,trips:v.trips.map(t=>({...t,packing:t.packing.map((p,i)=>({...p,packed:i===0}))}))}));await store.update(v=>saveTrip(v,{...trip,title:'Refined escape',itinerary:[{...entry(),title:'Edited walk'}]}));let value=await createTravelStore(disk).load();assert.equal(value.trips.length,1);assert.equal(value.trips[0].title,'Refined escape');assert.equal(value.trips[0].itinerary[0].title,'Edited walk');assert.equal(value.trips[0].packing[0].packed,true);assert.equal(value.trips[0].travelers,3);assert.equal(value.saved[0],'bali');await store.update(v=>({...v,trips:v.trips.filter(t=>t.id!==trip.id)}));value=await createTravelStore(disk).load();assert.equal(value.trips.length,0);assert.equal(value.saved[0],'bali');});
test('notification settings, per-message read state and clear history survive reload',async()=>{const disk=memory();const store=createTravelStore(disk);await store.load();let value=await store.update(v=>saveTrip(v,createTrip('bali','Escape','2099-04-20')));const id=value.notifications[0].id;value=await store.update(v=>markNotificationsRead(v,id));assert.equal(value.notifications[0].read,true);assert.equal(value.notificationsRead,false);value=await store.update(v=>markNotificationsRead(v));assert.equal(value.notificationsRead,true);value=await store.update(v=>({...v,preferences:{...v.preferences,tripUpdates:false,pace:'Relaxed',travelers:3,interests:['Culture']}}));const count=value.notifications.length;value=await store.update(v=>saveTrip(v,createTrip('kyoto','Quiet days','2099-05-20')));assert.equal(value.notifications.length,count);await store.update(v=>({...v,notifications:[],notificationsRead:true}));value=await createTravelStore(disk).load();assert.equal(value.preferences.pace,'Relaxed');assert.equal(value.preferences.travelers,3);assert.equal(value.preferences.interests[0],'Culture');assert.equal(value.notifications.length,0);});
test('malformed version-two activity data fails without replacing storage',()=>{const state=parseTravelState(null);const trip=createTrip('bali','Escape','2099-04-20');state.trips=[{...trip,itinerary:[{...entry(),cost:'25'}]}];assert.throws(()=>parseTravelState(JSON.stringify(state)),/original data/);});
