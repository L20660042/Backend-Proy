// create-admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  console.log('🚀 Conectando a MongoDB...');
  
  // 1. CONECTAR A MONGODB (usa TU conexión)
  const uri = 'mongodb+srv://luistoarzola_db_user:oPySQBXAF7EodFNX@proyecto.gdcgnsp.mongodb.net/proyecto1';
  
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    process.exit(1);
  }
  
  // 2. HASH DE LA CONTRASEÑA
  console.log('🔐 Generando hash de contraseña...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Admin123456', salt);
  
  // 3. DEFINIR EL ESQUEMA (igual que en tu proyecto)
  const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['superadmin', 'admin', 'jefe_departamento', 'docente', 'tutor', 'capacitacion', 'control_escolar', 'estudiante'],
      default: 'estudiante'
    },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
  
  // Crear índice único para email
  userSchema.index({ email: 1 }, { unique: true });
  
  // 4. VERIFICAR SI EL USUARIO YA EXISTE
  const User = mongoose.model('User', userSchema);
  
  const existingUser = await User.findOne({ email: 'superadmin@instituto.edu' });
  if (existingUser) {
    console.log('⚠️  El usuario ya existe. Actualizando contraseña...');
    existingUser.password = hashedPassword;
    existingUser.role = 'superadmin';
    existingUser.active = true;
    await existingUser.save();
    console.log('✅ Usuario actualizado');
  } else {
    // 5. CREAR NUEVO ADMIN
    console.log('👑 Creando nuevo superadmin...');
    const admin = new User({
      fullName: 'Super Administrador',
      email: 'superadmin@instituto.edu',
      password: hashedPassword,
      role: 'superadmin',
      active: true
    });
    
    await admin.save();
    console.log('✅ Superadmin creado exitosamente');
  }
  
  // 6. MOSTRAR CREDENCIALES
  console.log('\n==========================================');
  console.log('✅ ADMINISTRADOR CREADO/CONFIGURADO');
  console.log('==========================================');
  console.log('📧 Email: superadmin@instituto.edu');
  console.log('🔑 Password: Admin123456');
  console.log('👑 Rol: superadmin');
  console.log('🌐 Activo: true');
  console.log('==========================================\n');
  
  // 7. CERRAR CONEXIÓN
  await mongoose.disconnect();
  console.log('🔌 Conexión cerrada');
}

// Ejecutar la función
createAdmin().catch(err => {
  console.error('❌ ERROR CRÍTICO:', err.message);
  process.exit(1);
});