import { requireCloud } from './cloud-client';
import { type CloudLink } from './journey-types';
import { exportTrip, importPortable, readPortable } from './portable-data';
import { type TravelState, type Trip } from './travel-state';
export type Room = { id: string; owner: string; revision: number; document: unknown; updated_at: string };
export function tripDocument(state: TravelState, trip: Trip) { const doc = JSON.parse(exportTrip(state, trip)); return { schema: 1, trip: doc.data.trips[0], bags: doc.data.bags, places: doc.data.customPlaces }; }
export const documentSignature = (state: TravelState, trip: Trip) => JSON.stringify(tripDocument(state, trip));
export async function getRoom(id: string): Promise<Room> { const { data, error } = await requireCloud().from('waylo_rooms').select('id,owner,revision,document,updated_at').eq('id', id).single(); if (error) throw new Error(error.message); return data; }
export async function createRoom(document: unknown): Promise<Room> { const { data, error } = await requireCloud().rpc('waylo_create_room', { content: document }); if (error) throw new Error(error.message); return data; }
export async function publishRoom(room: string, revision: number, document: unknown): Promise<Room> { const { data, error } = await requireCloud().rpc('waylo_publish', { room, expected_revision: revision, content: document }); if (error) throw new Error(error.message.includes('revision_conflict') ? 'Another traveler changed this trip. Review the latest cloud copy before publishing again.' : error.message); return data; }
export async function createInvite(room: string, role: 'editor' | 'viewer') { const { data, error } = await requireCloud().rpc('waylo_invite', { room, access_role: role }); if (error) throw new Error(error.message); return String(data); }
export async function joinRoom(token: string): Promise<Room> { if (!/^[a-f0-9]{64}$/i.test(token.trim())) throw new Error('Paste the complete 64-character invitation code.'); const { data, error } = await requireCloud().rpc('waylo_join', { invitation: token.trim() }); if (error) throw new Error(error.message); return data; }
export function roomFile(room: Room) { const d = room.document as { trip?: Trip; bags?: unknown[]; places?: unknown[]; schema?: number }; if (!d || d.schema !== 1 || !d.trip || !Array.isArray(d.bags) || !Array.isArray(d.places)) throw new Error('The shared trip is incomplete.'); const state = JSON.parse(exportTrip({ trips: [], bags: [], customPlaces: [] } as unknown as TravelState, d.trip)).data; return readPortable(JSON.stringify({ kind: 'waylo-trip', schema: 1, createdAt: room.updated_at, data: { ...state, bags: d.bags, customPlaces: d.places } })); }
export function acceptRoom(state: TravelState, room: Room, userId: string, link?: CloudLink): TravelState {
  const file = roomFile(room); let next: TravelState; let id: string;
  if (link && state.trips.some((t) => t.id === link.tripId)) { id = link.tripId; const imported = importPortable(state, file); const incoming = imported.trips[0]; next = { ...imported, trips: state.trips.map((t) => t.id === id ? { ...incoming, id, title: file.data.trips[0].title } : t) }; }
  else { next = importPortable(state, file); id = next.trips[0].id; }
  const trip = next.trips.find((t) => t.id === id)!; return { ...next, cloudLinks: [...next.cloudLinks.filter((l) => l.roomId !== room.id || l.userId !== userId), { roomId: room.id, tripId: id, revision: room.revision, signature: documentSignature(next, trip), userId }] };
}
