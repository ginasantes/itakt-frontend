const META_OPEN = '[CompraMeta]';
const META_CLOSE = '[/CompraMeta]';

export const PURCHASE_FLOW_OPTIONS = [
  { value: 'lista', label: 'Lista / checklist' },
  { value: 'directa', label: 'Compra directa' }
];

export const PURCHASE_EVIDENCE_OPTIONS = [
  { value: 'folio', label: 'Con folio o factura' },
  { value: 'ticket', label: 'Con ticket' },
  { value: 'manual', label: 'Sin folio, describe la compra' }
];

export function getDefaultPurchaseCapture() {
  return {
    purchase_flow: 'lista',
    evidence_type: 'folio'
  };
}

export function normalizePurchaseFlow(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'compra directa' || normalized === 'directa') {
    return 'directa';
  }
  return 'lista';
}

export function normalizePurchaseEvidence(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('ticket')) {
    return 'ticket';
  }
  if (normalized.includes('manual') || normalized.includes('sin folio')) {
    return 'manual';
  }
  return 'folio';
}

export function getPurchaseFlowLabel(value) {
  return PURCHASE_FLOW_OPTIONS.find((option) => option.value === value)?.label || 'Sin clasificar';
}

export function getPurchaseEvidenceLabel(value) {
  return PURCHASE_EVIDENCE_OPTIONS.find((option) => option.value === value)?.label || 'Sin evidencia';
}

function normalizeLineValue(value) {
  const text = String(value || '').trim();
  return text ? text.replaceAll('\n', ' ').trim() : '';
}

export function buildPurchaseMetadataBlock({ purchaseFlow, evidenceType }) {
  const normalizedFlow = normalizeLineValue(purchaseFlow);
  const normalizedEvidence = normalizeLineValue(evidenceType);
  const lines = [];

  if (normalizedFlow) {
    lines.push(`Flujo: ${normalizedFlow}`);
  }

  if (normalizedEvidence) {
    lines.push(`Evidencia: ${normalizedEvidence}`);
  }

  if (!lines.length) {
    return '';
  }

  return `${META_OPEN}\n${lines.join('\n')}\n${META_CLOSE}`;
}

export function stripPurchaseMetadataBlock(text) {
  return String(text || '')
    .replace(/\[CompraMeta\][\s\S]*?\[\/CompraMeta\]\s*/i, '')
    .replace(/^\s+|\s+$/g, '');
}

export function parsePurchaseMetadata(text) {
  const source = String(text || '');
  const match = source.match(/\[CompraMeta\]\s*([\s\S]*?)\s*\[\/CompraMeta\]/i);
  const defaults = getDefaultPurchaseCapture();

  if (!match) {
    return {
      metadata: defaults,
      baseNote: stripPurchaseMetadataBlock(source).split('[Recepción]')[0].trim(),
      noteWithoutMetadata: stripPurchaseMetadataBlock(source)
    };
  }

  const lines = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metadata = { ...defaults };

  lines.forEach((line) => {
    const [rawKey, ...rest] = line.split(':');
    const key = String(rawKey || '').trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'flujo') {
      metadata.purchase_flow = normalizePurchaseFlow(value || defaults.purchase_flow);
    }

    if (key === 'evidencia') {
      metadata.evidence_type = normalizePurchaseEvidence(value || defaults.evidence_type);
    }
  });

  const noteWithoutMetadata = stripPurchaseMetadataBlock(source);

  return {
    metadata,
    baseNote: noteWithoutMetadata.split('[Recepción]')[0].trim(),
    noteWithoutMetadata
  };
}

export function buildPurchaseObservations({ note, purchaseFlow, evidenceType }) {
  const cleanNote = String(note || '').trim();
  const metadataBlock = buildPurchaseMetadataBlock({ purchaseFlow, evidenceType });
  return [cleanNote, metadataBlock].filter(Boolean).join('\n');
}