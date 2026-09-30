// Datos del Agente de sucursal. TODO es ficticio: "Banco Demo" no existe y las
// políticas, tasas y clientes son de ejemplo para el workshop.
window.AGENT_DATA = {
  // Core bancario simulado (lo consulta la herramienta buscar_cliente).
  clientes: [
    {
      dni: '30123456', nombre: 'Martina Sosa', fecha_nacimiento: '1983-05-21',
      situacion_laboral: 'Relación de dependencia', empleador: 'Metalúrgica del Centro S.A.', antiguedad_laboral_meses: 52,
      ingreso_neto_mensual: 1450000, cobra_haberes_en_banco: true,
      situacion_bcra: 1, score_interno: 742,
      productos: ['Cuenta sueldo', 'Tarjeta Visa', 'Préstamo prendario'],
      cuotas_vigentes: [{ producto: 'Préstamo prendario', cuota_mensual: 180000, cuotas_restantes: 14 }],
      alertas: [],
    },
    {
      dni: '27987654', nombre: 'Jorge Ferreyra', fecha_nacimiento: '1990-11-02',
      situacion_laboral: 'Monotributista (categoría D)', empleador: null, antiguedad_laboral_meses: 18,
      ingreso_neto_mensual: 1900000, cobra_haberes_en_banco: false,
      situacion_bcra: 1, score_interno: 688,
      productos: ['Caja de ahorro'],
      cuotas_vigentes: [],
      alertas: [],
    },
    {
      dni: '35555111', nombre: 'Lucía Paz', fecha_nacimiento: '1991-02-14',
      situacion_laboral: 'Relación de dependencia', empleador: 'Clínica San Martín', antiguedad_laboral_meses: 30,
      ingreso_neto_mensual: 1200000, cobra_haberes_en_banco: true,
      situacion_bcra: 2, score_interno: 610,
      productos: ['Cuenta sueldo', 'Tarjeta Mastercard'],
      cuotas_vigentes: [{ producto: 'Tarjeta Mastercard (pago mínimo)', cuota_mensual: 95000, cuotas_restantes: null }],
      alertas: ['Atraso de 45 días en tarjeta en los últimos 6 meses'],
    },
    {
      dni: '20111222', nombre: 'Ricardo Molina', fecha_nacimiento: '1954-08-30',
      situacion_laboral: 'Jubilado', empleador: 'ANSES', antiguedad_laboral_meses: 120,
      ingreso_neto_mensual: 980000, cobra_haberes_en_banco: true,
      situacion_bcra: 1, score_interno: 770,
      productos: ['Cuenta previsional', 'Tarjeta Visa'],
      cuotas_vigentes: [],
      alertas: [],
    },
  ],

  // Base de conocimiento para el RAG. Cada sección es un fragmento que se indexa por separado.
  documentos: [
    {
      id: 'POL-PP', titulo: 'Política de Préstamos Personales', secciones: [
        { n: '1', titulo: 'Alcance', texto: 'Aplica a préstamos personales en pesos, a tasa fija y sistema francés, para personas humanas clientes del banco. No aplica a préstamos prendarios, hipotecarios ni a líneas con subsidio de tasa.' },
        { n: '2', titulo: 'Requisitos del solicitante', texto: 'Edad mínima 18 años. La edad del cliente al vencimiento de la última cuota no puede superar los 75 años. Antigüedad laboral mínima: 12 meses para relación de dependencia, 24 meses para monotributistas y autónomos. Los jubilados y pensionados no requieren antigüedad laboral.' },
        { n: '3', titulo: 'Capacidad de pago', texto: 'La relación cuota/ingreso no puede superar el 30 % del ingreso neto mensual. El tope sube al 35 % si el cliente cobra sus haberes o jubilación en el banco. El cálculo incluye la cuota nueva más todas las cuotas vigentes del cliente (préstamos y pago mínimo de tarjetas).' },
        { n: '4', titulo: 'Situación en la Central de Deudores', texto: 'Situación 1 (normal): se puede aprobar. Situación 2 (riesgo bajo o seguimiento especial): no se aprueba en sucursal, se deriva al Comité de Créditos con informe del oficial. Situación 3 o superior: se rechaza la solicitud.' },
        { n: '5', titulo: 'Montos y plazos', texto: 'Monto mínimo $300.000. Monto máximo: el menor entre 12 veces el ingreso neto mensual y $30.000.000. Plazo entre 6 y 60 meses.' },
        { n: '6', titulo: 'Niveles de aprobación', texto: 'Hasta $5.000.000 aprueba el oficial de sucursal. Más de $5.000.000 y hasta $15.000.000 aprueba el gerente regional. Más de $15.000.000, o cualquier caso derivado por situación en la Central de Deudores, aprueba el Comité de Créditos. Toda derivación se registra con un ticket.' },
        { n: '7', titulo: 'Documentación', texto: 'DNI vigente, último recibo de sueldo (o las tres últimas facturas y constancia de monotributo), y constancia de CBU si no cobra haberes en el banco.' },
      ],
    },
    {
      id: 'TAR', titulo: 'Tarifario de Préstamos y Tarjetas', secciones: [
        { n: '1', titulo: 'Tasas de préstamos personales', texto: 'TNA fija 55 % para clientes que cobran haberes o jubilación en el banco. TNA fija 62 % para el resto de los clientes. Para plazos mayores a 36 meses se suman 3 puntos porcentuales a la TNA.' },
        { n: '2', titulo: 'Comisiones de préstamos', texto: 'Comisión de otorgamiento: 2 % del capital, se descuenta al acreditar. Cancelación anticipada total: sin cargo si pasaron 180 días desde la acreditación; antes, 4 % del saldo de capital.' },
        { n: '3', titulo: 'Tarjetas de crédito', texto: 'Límite de compra inicial: hasta 1,5 veces el ingreso neto mensual. Renovación anual bonificada para clientes con cuenta sueldo. TNA de financiación de saldo: 88 %.' },
      ],
    },
    {
      id: 'PROC-AF', titulo: 'Procedimiento Antifraude en Sucursal', secciones: [
        { n: '1', titulo: 'Señales de alerta', texto: 'Cliente acompañado por un tercero que habla por él, apuro inusual, pedido de préstamo preaprobado seguido de transferencia inmediata a cuentas nuevas, cambio reciente de teléfono o mail asociado a la cuenta.' },
        { n: '2', titulo: 'Acción ante sospecha', texto: 'No acreditar ni desembolsar. Bloquear preventivamente los canales digitales, contactar al cliente por el teléfono registrado hace más de 90 días y abrir un ticket de tipo fraude con prioridad alta.' },
        { n: '3', titulo: 'Comunicación con el cliente', texto: 'El banco nunca pide claves, códigos de verificación ni token por teléfono, mail o WhatsApp. Recordárselo al cliente en toda gestión.' },
      ],
    },
    {
      id: 'PROC-KYC', titulo: 'Alta y Conocimiento del Cliente', secciones: [
        { n: '1', titulo: 'Documentación de alta', texto: 'DNI vigente, constancia de CUIL y declaración jurada de licitud y origen de fondos. Validación biométrica contra el RENAPER en el alta digital.' },
        { n: '2', titulo: 'Personas expuestas políticamente', texto: 'Si el cliente es PEP se requiere aprobación del Oficial de Cumplimiento antes de otorgar cualquier producto de crédito, y se aplica debida diligencia reforzada.' },
        { n: '3', titulo: 'Actualización de legajo', texto: 'Los legajos se actualizan cada 24 meses o antes si cambia la situación laboral declarada. Un legajo desactualizado bloquea el otorgamiento de nuevos créditos.' },
      ],
    },
    {
      id: 'FAQ', titulo: 'Preguntas frecuentes de atención', secciones: [
        { n: '1', titulo: 'Acreditación del préstamo', texto: 'Una vez aprobado, el préstamo se acredita en la cuenta del cliente dentro de las 24 horas hábiles.' },
        { n: '2', titulo: 'Refinanciación', texto: 'Se puede refinanciar un préstamo personal con al menos 6 cuotas pagas y sin atrasos mayores a 30 días. La refinanciación se evalúa como un préstamo nuevo.' },
        { n: '3', titulo: 'Fecha de vencimiento', texto: 'La cuota vence el día 10 de cada mes; si cobra haberes en el banco se debita automáticamente el día de acreditación del sueldo.' },
      ],
    },
  ],
};
