
export interface Room {
  id: string;
  name: string;
  creator: string;
  status: 'ready'|'deleting'|'not_ready';
}
