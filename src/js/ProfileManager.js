import { loadProfile, saveProfile, hashCode, resizeAvatar } from './data/Profile.js'
import { getSelectedCharacterId, getCharacterById, formatBalance } from './data/Characters.js'
import { getWallet } from './data/Economy.js'

// Экран «МОЙ ПРОФИЛЬ»: имя (обязательно), аватар/about/gmail/код — optional.
// Профиль игрока отделён от персонажа (CHARACTER): здесь только данные игрока
// + отображение выбранного персонажа и его баланса (read-only).
export class ProfileManager {
  constructor(menuManager) {
    this.menuManager = menuManager
    this.screen = document.getElementById('profile-screen')
    this.backBtn = document.getElementById('btn-profile-back')
    this.editBtn = document.getElementById('btn-profile-edit')
    this.saveBtn = document.getElementById('btn-profile-save')

    this.view = document.getElementById('profile-view')
    this.form = document.getElementById('profile-form')

    this.nameInput = document.getElementById('profile-name')
    this.aboutInput = document.getElementById('profile-about')
    this.emailInput = document.getElementById('profile-email')
    this.codeInput = document.getElementById('profile-code')
    this.avatarInput = document.getElementById('profile-avatar-input')
    this.avatarPreview = document.getElementById('profile-avatar-preview')
    this.avatarImg = document.getElementById('profile-avatar-img')
    this.avatarEmpty = document.getElementById('profile-avatar-empty')

    this._pendingAvatar = null // dataURL после resize, до сохранения
    this._editing = false

    this.backBtn.addEventListener('click', (e) => { e.currentTarget.blur(); this.close() })
    this.editBtn.addEventListener('click', (e) => { e.currentTarget.blur(); this.setEditing(true) })
    this.saveBtn.addEventListener('click', (e) => { e.currentTarget.blur(); this._onSave() })
    this.avatarInput.addEventListener('change', () => this._onAvatarPicked())
  }

  open() {
    this.menuManager.hideMenu()
    this._pendingAvatar = null
    this.setEditing(false)
    this._render()
    this.screen.classList.add('active')
  }

  close() {
    this.screen.classList.remove('active')
    this.menuManager.showMenu()
  }

  refreshCharacterLine() {
    // Обновить строку персонажа/баланса без переоткрытия (после победы)
    if (this.screen.classList.contains('active')) this._render()
  }

  setEditing(on) {
    this._editing = on
    this.view.classList.toggle('hidden', on)
    this.form.classList.toggle('hidden', !on)
    if (on) this._fillForm()
  }

  _render() {
    const p = loadProfile()
    const charId = getSelectedCharacterId()
    const char = getCharacterById(charId)
    const bal = getWallet()

    this.view.innerHTML = ''

    const av = document.createElement('div')
    av.className = 'profile-avatar-big'
    if (p.avatar) {
      const img = document.createElement('img')
      img.src = p.avatar
      img.alt = 'Аватар'
      av.appendChild(img)
    } else {
      av.textContent = '👤'
    }

    const name = document.createElement('div')
    name.className = 'profile-name'
    name.textContent = p.name || 'Без имени'

    this.view.append(av, name)

    if (p.email) {
      const em = document.createElement('div')
      em.className = 'profile-email'
      em.textContent = p.email
      this.view.appendChild(em)
    }
    if (p.about) {
      const ab = document.createElement('blockquote')
      ab.className = 'profile-about'
      ab.textContent = '«' + p.about + '»'
      this.view.appendChild(ab)
    }

    const hr = document.createElement('hr')
    hr.className = 'profile-hr'
    this.view.appendChild(hr)

    const cl = document.createElement('div')
    cl.className = 'profile-char-line'
    cl.innerHTML = ''
    const l1 = document.createElement('div')
    l1.className = 'profile-char-label'
    l1.textContent = 'Выбранный персонаж:'
    const v1 = document.createElement('div')
    v1.className = 'profile-char-value'
    v1.textContent = char.name
    const l2 = document.createElement('div')
    l2.className = 'profile-char-label'
    l2.textContent = 'Баланс:'
    const v2 = document.createElement('div')
    v2.className = 'profile-char-balance'
    v2.textContent = formatBalance(bal)
    cl.append(l1, v1, l2, v2)
    this.view.appendChild(cl)

    if (!p.name) {
      const hint = document.createElement('div')
      hint.className = 'profile-hint'
      hint.textContent = 'Нажмите «Редактировать», чтобы создать профиль.'
      this.view.appendChild(hint)
    }
  }

  _fillForm() {
    const p = loadProfile()
    this.nameInput.value = p.name || ''
    this.aboutInput.value = p.about || ''
    this.emailInput.value = p.email || ''
    this.codeInput.value = ''
    this._pendingAvatar = null
    this._updateAvatarPreview(p.avatar || '')
  }

  _updateAvatarPreview(dataUrl) {
    const src = this._pendingAvatar || dataUrl
    if (src) {
      this.avatarImg.src = src
      this.avatarImg.classList.remove('hidden')
      this.avatarEmpty.classList.add('hidden')
    } else {
      this.avatarImg.removeAttribute('src')
      this.avatarImg.classList.add('hidden')
      this.avatarEmpty.classList.remove('hidden')
    }
  }

  async _onAvatarPicked() {
    const f = this.avatarInput.files && this.avatarInput.files[0]
    if (!f) return
    try {
      const small = await resizeAvatar(f, 256, 0.82)
      this._pendingAvatar = small
      this._updateAvatarPreview(small)
    } catch (e) {
      this.avatarInput.value = ''
    }
  }

  async _onSave() {
    const prev = loadProfile()
    const name = this.nameInput.value.trim()
    if (!name) {
      this.nameInput.focus()
      this.nameInput.classList.add('input-error')
      setTimeout(() => this.nameInput.classList.remove('input-error'), 1200)
      return
    }
    const email = this.emailInput.value.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.emailInput.focus()
      this.emailInput.classList.add('input-error')
      setTimeout(() => this.emailInput.classList.remove('input-error'), 1200)
      return
    }
    let codeHash = prev.codeHash || ''
    const code = this.codeInput.value
    if (code) codeHash = await hashCode(code)
    // Пустое поле кода = оставить прежний hash (не сбрасываем молча).
    // Сброс — только через очистку профиля в будущем; пока сохраняем.

    const saved = saveProfile({
      name,
      avatar: this._pendingAvatar !== null ? this._pendingAvatar : (prev.avatar || ''),
      about: this.aboutInput.value.trim(),
      email,
      codeHash
    })
    this._pendingAvatar = null
    this.avatarInput.value = ''
    this.setEditing(false)
    this._render()
    return saved
  }
}
