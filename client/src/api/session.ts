import { projectInputMock, type UserInput } from './api'

const INPUT_STORAGE_KEY = 'project-input'

export const saveProjectInput = (input: UserInput) => {
  window.sessionStorage.setItem(INPUT_STORAGE_KEY, JSON.stringify(input))
}

export const loadProjectInput = (): UserInput => {
  const value = window.sessionStorage.getItem(INPUT_STORAGE_KEY)

  if (!value) {
    return projectInputMock
  }

  try {
    return JSON.parse(value) as UserInput
  } catch {
    return projectInputMock
  }
}
