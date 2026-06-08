import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class LocationNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Location ${id} not found`);
  }
}

export class InvalidParentException extends UnprocessableEntityException {
  constructor(message: string) {
    super(message);
  }
}

export class DuplicateLocationNumberException extends ConflictException {
  constructor(locationNumber: string) {
    super(`Location number "${locationNumber}" already exists`);
  }
}

export class LocationHasChildrenException extends ConflictException {
  constructor(id: string) {
    super(`Location ${id} has children; pass ?cascade=true to delete the subtree`);
  }
}

export class BookingNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Booking ${id} not found`);
  }
}

export class LocationNotBookableException extends UnprocessableEntityException {
  constructor(id: string) {
    super(`Location ${id} is not a bookable room`);
  }
}

export class BookingRejectedException extends BadRequestException {
  constructor(reasons: string[]) {
    super({ message: 'Booking rejected', reasons });
  }
}
