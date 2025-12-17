import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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

    const passwordHash = await bcrypt.hash(pass, 12);
    await this.users.create({
      email,
      passwordHash,
      roles: [Role.SUPERADMIN],
      status: 'active',
    });

    // Nota: no imprimimos el password.
    console.log(`[seed] Superadmin creado: ${email}`);
  }
}
