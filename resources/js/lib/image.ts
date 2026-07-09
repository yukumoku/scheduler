const MAX_AVATAR_BYTES = 900 * 1024
const MAX_AVATAR_SIZE = 512

function extensionFromMime(type: string): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error('画像を変換できませんでした。別の画像をお試しください。'))
    }, type, quality)
  })
}

export async function resizeAvatarFile(file: File): Promise<File> {
  if (file.type === 'image/gif') {
    if (file.size <= MAX_AVATAR_BYTES) {
      return file
    }

    throw new Error('GIF画像が大きすぎます。1MB未満の画像を選んでください。')
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選んでください。')
  }

  if (file.size <= MAX_AVATAR_BYTES) {
    return file
  }

  const imageUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = imageUrl
    await image.decode()

    const scale = Math.min(1, MAX_AVATAR_SIZE / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('画像を読み込めませんでした。別の画像をお試しください。')
    }

    context.drawImage(image, 0, 0, width, height)

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    let quality = 0.86
    let blob = await canvasToBlob(canvas, outputType, quality)

    while (blob.size > MAX_AVATAR_BYTES && quality > 0.55) {
      quality -= 0.08
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }

    if (blob.size > MAX_AVATAR_BYTES) {
      throw new Error('画像が大きすぎます。別の画像を選んでください。')
    }

    return new File([blob], `avatar.${extensionFromMime(blob.type)}`, { type: blob.type })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
