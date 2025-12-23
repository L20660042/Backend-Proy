import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Role } from '../auth/roles.enum';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private users: UsersService) {}

  async onModuleInit() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const pass = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !pass) return;

    const existing = await this.users.findByEmail(email);
    if (existing) return;

    await this.users.create({
      email,
      password: pass,        
      roles: [Role.SUPERADMIN],
      status: 'active',
    });

    console.log(`[seed] Superadmin creado: ${email}`);
  }
}
