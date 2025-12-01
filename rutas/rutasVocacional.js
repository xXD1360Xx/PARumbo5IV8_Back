import express from 'express';
import { autenticarUsuario } from '../middleware/autenticacionMiddleware.js';
import { pool } from '../configuracion/baseDeDatos.js';

const router = express.Router();

// GET /api/vocacional/historial/:usuarioId - Obtener historial de resultados vocacionales
router.get('/historial/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    // Validar que el usuarioId sea un UUID válido
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const consulta = `
      SELECT 
        id,
        usuario_id,
        fecha,
        respuestas,
        carreras,
        promedio_general,
        zona_ikigai,
        created_at,
        updated_at
      FROM user_vocational_results 
      WHERE usuario_id = $1 
      ORDER BY fecha DESC
    `;
    
    const resultado = await pool.query(consulta, [usuarioId]);
    
    // Procesar los resultados para parsear los JSON
    const resultadosProcesados = resultado.rows.map(item => ({
      id: item.id,
      usuario_id: item.usuario_id,
      fecha: item.fecha,
      respuestas: typeof item.respuestas === 'string' ? JSON.parse(item.respuestas) : item.respuestas,
      carreras: typeof item.carreras === 'string' ? JSON.parse(item.carreras) : item.carreras,
      promedio_general: item.promedio_general,
      zona_ikigai: item.zona_ikigai,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
    
    res.json({ 
      exito: true, 
      datos: resultadosProcesados,
      mensaje: 'Historial vocacional obtenido exitosamente',
      total: resultadosProcesados.length
    });
  } catch (error) {
    console.error('Error al obtener historial vocacional:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el historial de resultados vocacionales' 
    });
  }
});

// GET /api/vocacional/ultimo/:usuarioId - Obtener el último resultado vocacional
router.get('/ultimo/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const consulta = `
      SELECT 
        id,
        usuario_id,
        fecha,
        respuestas,
        carreras,
        promedio_general,
        zona_ikigai,
        created_at,
        updated_at
      FROM user_vocational_results 
      WHERE usuario_id = $1 
      ORDER BY fecha DESC
      LIMIT 1
    `;
    
    const resultado = await pool.query(consulta, [usuarioId]);
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        error: 'No se encontraron resultados vocacionales para este usuario'
      });
    }

    const ultimoResultado = resultado.rows[0];
    
    // Procesar el resultado
    const resultadoProcesado = {
      id: ultimoResultado.id,
      usuario_id: ultimoResultado.usuario_id,
      fecha: ultimoResultado.fecha,
      respuestas: typeof ultimoResultado.respuestas === 'string' ? JSON.parse(ultimoResultado.respuestas) : ultimoResultado.respuestas,
      carreras: typeof ultimoResultado.carreras === 'string' ? JSON.parse(ultimoResultado.carreras) : ultimoResultado.carreras,
      promedio_general: ultimoResultado.promedio_general,
      zona_ikigai: ultimoResultado.zona_ikigai,
      created_at: ultimoResultado.created_at,
      updated_at: ultimoResultado.updated_at
    };
    
    res.json({ 
      exito: true, 
      datos: resultadoProcesado,
      mensaje: 'Último resultado vocacional obtenido exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener último resultado vocacional:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener el último resultado vocacional' 
    });
  }
});

// GET /api/vocacional/estadisticas/:usuarioId - Obtener estadísticas vocacionales
router.get('/estadisticas/:usuarioId', autenticarUsuario, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    if (!usuarioId || usuarioId.length < 10) {
      return res.status(400).json({
        exito: false,
        error: 'ID de usuario inválido'
      });
    }

    const consulta = `
      SELECT 
        COUNT(*) as total_resultados,
        AVG(promedio_general) as promedio_general,
        MAX(fecha) as fecha_ultimo,
        zona_ikigai,
        COUNT(*) as cantidad_por_zona
      FROM user_vocational_results 
      WHERE usuario_id = $1 
      GROUP BY zona_ikigai
      ORDER BY cantidad_por_zona DESC
    `;
    
    const resultado = await pool.query(consulta, [usuarioId]);
    
    // Obtener también el total de resultados
    const totalQuery = `SELECT COUNT(*) as total FROM user_vocational_results WHERE usuario_id = $1`;
    const totalResult = await pool.query(totalQuery, [usuarioId]);
    
    const estadisticas = {
      total_resultados: parseInt(totalResult.rows[0].total),
      distribucion_zonas: resultado.rows.map(item => ({
        zona_ikigai: item.zona_ikigai,
        cantidad: parseInt(item.cantidad_por_zona),
        porcentaje: Math.round((parseInt(item.cantidad_por_zona) / parseInt(totalResult.rows[0].total)) * 100)
      }))
    };
    
    res.json({ 
      exito: true, 
      datos: estadisticas,
      mensaje: 'Estadísticas vocacionales obtenidas exitosamente'
    });
  } catch (error) {
    console.error('Error al obtener estadísticas vocacionales:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al obtener estadísticas vocacionales' 
    });
  }
});

export default router;