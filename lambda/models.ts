
export class Room {
  public id: string;
  public name?: string;
  public creatorId?: string;

  constructor(props: RoomProps) {
    Object.assign(this, props);
  }

  static fromItem(item: any): Room {
    return new Room({
        id: item.id.S,
        name: item.name.S,
        creatorId: item.creatorId.S,
      }
    );
  }

  toItem() {
    return{
      id: {S: this.id},
      name: {S: this.name},
      creatorId: {S: this.creatorId},
    }
  }
}

export interface RoomProps {
  id: string;
  name?: string;
  creatorId?: string;
}
