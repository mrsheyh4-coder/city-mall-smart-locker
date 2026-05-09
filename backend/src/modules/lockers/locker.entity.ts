import { LockerStatus } from './locker-status.enum';

export interface Locker {
  id: string;
  number: number;
  status: LockerStatus;
  isOpen: boolean;
  pinCode: string | null;
  createdAt: string;
}
