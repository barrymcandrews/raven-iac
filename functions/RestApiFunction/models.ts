
export class Room {
  public id: string;
  public name?: string;
  public creator?: string;

  constructor(props: RoomProps) {
    Object.assign(this, props);
  }

  static fromItem(item: any): Room {
    return new Room({
        id: item.id.S,
        name: item.name.S,
        creator: item.creator.S,
      }
    );
  }

  toItem() {
    return{
      id: {S: this.id},
      name: {S: this.name},
      creator: {S: this.creator},
    }
  }
}

export interface RoomProps {
  id: string;
  name?: string;
  creator?: string;
}
