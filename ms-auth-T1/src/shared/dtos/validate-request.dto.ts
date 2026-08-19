export class ValidateRequestDto {
  credential!: string;
  action?: string;
  resource?: string;
  resourceOwnerId?: string;
  graphqlOperation?: string;
}

