import type { LotSpec, RoomSpec, RoomType } from '../types';
import { ROOM_META } from '../types';

interface Props {
  lot: LotSpec;
  rooms: RoomSpec[];
  onLotChange: (lot: LotSpec) => void;
  onRoomsChange: (rooms: RoomSpec[]) => void;
}

let uid = 100;

export function RoomForm({ lot, rooms, onLotChange, onRoomsChange }: Props) {
  const update = (id: string, patch: Partial<RoomSpec>) => {
    onRoomsChange(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRoom = () => {
    onRoomsChange([
      ...rooms,
      {
        id: `u${uid++}`,
        type: 'bedroom',
        label: `Room ${rooms.length + 1}`,
        targetArea: ROOM_META.bedroom.defaultArea,
      },
    ]);
  };

  const removeRoom = (id: string) => {
    onRoomsChange(
      rooms
        .filter((r) => r.id !== id)
        .map((r) => (r.adjacentTo === id ? { ...r, adjacentTo: undefined } : r)),
    );
  };

  const totalRooms = rooms.reduce((s, r) => s + r.targetArea, 0);
  const lotArea = lot.width * lot.depth;

  return (
    <div className="room-form">
      <div className="section-title">Lot</div>
      <div className="lot-row">
        <label>
          Width (m)
          <input
            type="number"
            min={4}
            max={60}
            step={0.5}
            value={lot.width}
            onChange={(e) => onLotChange({ ...lot, width: Number(e.target.value) })}
          />
        </label>
        <label>
          Depth (m)
          <input
            type="number"
            min={4}
            max={60}
            step={0.5}
            value={lot.depth}
            onChange={(e) => onLotChange({ ...lot, depth: Number(e.target.value) })}
          />
        </label>
        <div className="lot-area">{lotArea.toFixed(0)} m²</div>
      </div>

      <div className="section-title">
        Rooms
        <button className="btn-small" onClick={addRoom}>
          + Add room
        </button>
      </div>

      <div className="room-table">
        {rooms.map((r) => (
          <div className="room-row" key={r.id}>
            <input
              className="room-name"
              value={r.label}
              onChange={(e) => update(r.id, { label: e.target.value })}
            />
            <select
              value={r.type}
              onChange={(e) => update(r.id, { type: e.target.value as RoomType })}
            >
              {(Object.keys(ROOM_META) as RoomType[]).map((t) => (
                <option key={t} value={t}>
                  {ROOM_META[t].label}
                </option>
              ))}
            </select>
            <input
              className="room-area"
              type="number"
              min={2}
              max={100}
              step={1}
              value={r.targetArea}
              title="Target area (m²)"
              onChange={(e) => update(r.id, { targetArea: Number(e.target.value) })}
            />
            <select
              className="room-adj"
              value={r.adjacentTo ?? ''}
              title="Must be adjacent to"
              onChange={(e) => update(r.id, { adjacentTo: e.target.value || undefined })}
            >
              <option value="">adjacency: auto</option>
              {rooms
                .filter((o) => o.id !== r.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    next to {o.label}
                  </option>
                ))}
            </select>
            <button className="btn-icon" title="Remove" onClick={() => removeRoom(r.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className={`area-check ${totalRooms > lotArea ? 'warn' : ''}`}>
        Rooms total {totalRooms.toFixed(0)} m² / lot {lotArea.toFixed(0)} m²
        {totalRooms > lotArea && ' — rooms will be scaled down to fit'}
      </div>
    </div>
  );
}
