@Get('debug/test-import')
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
async testImport() {
  try {
    this.logger.log('🧪 Creando archivo de prueba para importación...');
    
    // Crear un archivo Excel de prueba simple
    const workbook = XLSX.utils.book_new();
    
    // Hoja de carreras con nombres de columnas en español
    const carrerasData = [
      ['Nombre', 'Código', 'Descripción', 'Duración', 'Activo'],
      ['Ingeniería en Sistemas', 'ISIS', 'Ingeniería en Sistemas Computacionales', '8', 'Si'],
      ['Administración', 'ADM', 'Licenciatura en Administración', '8', 'True'],
      ['Contaduría', 'CONTA', 'Licenciatura en Contaduría', '8', '1']
    ];
    
    const carrerasSheet = XLSX.utils.aoa_to_sheet(carrerasData);
    XLSX.utils.book_append_sheet(workbook, carrerasSheet, 'Carreras');

    // Hoja de usuarios con nombres de columnas en español
    const usuariosData = [
      ['Email', 'Rol', 'Nombre Completo', 'Contraseña', 'Carrera'],
      ['admin@test.com', 'ADMIN', 'Administrador Principal', 'admin123', 'Ingeniería en Sistemas'],
      ['docente@test.com', 'DOCENTE', 'Profesor de Prueba', 'docente123', 'Ingeniería en Sistemas'],
      ['estudiante@test.com', 'ESTUDIANTE', 'Estudiante Ejemplo', 'estudiante123', 'Ingeniería en Sistemas']
    ];
    
    const usuariosSheet = XLSX.utils.aoa_to_sheet(usuariosData);
    XLSX.utils.book_append_sheet(workbook, usuariosSheet, 'Usuarios');

    // Generar buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx'
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `archivo_prueba_${timestamp}.xlsx`;

    // Crear archivo de prueba en temp
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    
    const tmpDir = os.tmpdir();
    const uploadDir = path.join(tmpDir, 'metricampus-uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    
    this.logger.log(`✅ Archivo de prueba creado: ${filePath}`);
    
    return {
      success: true,
      message: 'Archivo de prueba creado',
      filePath: filePath,
      downloadUrl: `/excel/debug/download-test?file=${filename}`
    };

  } catch (error: any) {
    this.logger.error('❌ Error creando archivo de prueba:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

@Get('debug/download-test')
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
async downloadTestFile(@Res() res: Response) {
  try {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    
    const tmpDir = os.tmpdir();
    const uploadDir = path.join(tmpDir, 'metricampus-uploads');
    const filename = 'archivo_prueba.xlsx';
    const filePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Archivo de prueba no encontrado');
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    res.send(fileBuffer);
    
  } catch (error: any) {
    this.logger.error('❌ Error descargando archivo de prueba:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}