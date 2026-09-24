/**
 * Provider-independent media boundary.
 *
 * Saving stores references and presentation metadata only. A platform media
 * provider can be injected in a later integration without changing page
 * rendering or the Saving flow. This preview app deliberately has no upload
 * implementation and never treats a local file as a successful cloud upload.
 */
export const MEDIA_TYPES = Object.freeze({ image: 'image', video: 'video' });
export const MEDIA_LIMITS = Object.freeze({ image: 6, video: 1 });

export function normalizeMedia(item = {}, pageType = 'image') {
  return {
    mediaId: String(item.mediaId || item.id || '').trim(),
    mediaType: pageType === MEDIA_TYPES.video ? MEDIA_TYPES.video : MEDIA_TYPES.image,
    providerType: String(item.providerType || '').trim(),
    cloudFileRef: String(item.cloudFileRef || item.reference || '').trim(),
    title: String(item.title || '').trim(),
    altText: String(item.altText || '').trim(),
    width: positiveNumber(item.width),
    height: positiveNumber(item.height),
    displayOrder: Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : 0,
    fit: item.fit === 'contain' ? 'contain' : 'cover'
  };
}

export function normalizeMediaList(items, pageType) {
  const list = Array.isArray(items) ? items : [];
  return list.slice(0, MEDIA_LIMITS[pageType] || MEDIA_LIMITS.image)
    .map(item => normalizeMedia(item, pageType))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function mediaIsConfigured(media) {
  return Boolean(media?.providerType && media?.cloudFileRef);
}

export function mediaProviderStatus() {
  return { available: false, providerType: null, message: 'Cloud 媒體服務尚未連接。' };
}

export function mediaCanRender(media) {
  return mediaIsConfigured(media) && mediaProviderStatus().available;
}

export function mediaFallbackLabel() { return '媒體暫時無法使用'; }

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
