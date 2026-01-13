import { create } from 'zustand'

/**
 * 全局任务状态管理
 * 用于跨页面保持任务状态，解决切换窗口后状态丢失的问题
 */

export type TaskType = 'parameter_update' | 'pci_planning' | 'neighbor_planning' | 'upload'
export type TaskStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface Task {
  id: string
  type: TaskType
  status: TaskStatus
  message?: string
  progress?: number
  startTime?: number
  endTime?: number
  result?: any
}

interface TaskState {
  tasks: Record<string, Task>

  // 获取所有运行中的任务
  getRunningTasks: () => Task[]

  // 开始任务
  startTask: (id: string, type: TaskType, message?: string) => void

  // 更新任务进度
  updateTaskProgress: (id: string, progress: number, message?: string) => void

  // 完成任务
  completeTask: (id: string, result?: any) => void

  // 任务失败
  failTask: (id: string, message: string) => void

  // 获取任务状态
  getTaskStatus: (id: string) => TaskStatus

  // 获取任务
  getTask: (id: string) => Task | undefined

  // 清除任务
  clearTask: (id: string) => void

  // 清除所有已完成/失败的任务
  clearFinishedTasks: () => void
  
  // 获取最新的PCI规划任务结果
  getLatestPCITask: () => Task | undefined
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},

  getRunningTasks: () => {
    const state = get()
    return Object.values(state.tasks).filter(task => task.status === 'running')
  },

  startTask: (id, type, message) => {
    set(state => ({
      tasks: {
        ...state.tasks,
        [id]: {
          id,
          type,
          status: 'running',
          message,
          progress: 0,
          startTime: Date.now()
        }
      }
    }))
  },

  updateTaskProgress: (id, progress, message) => {
    set(state => {
      const task = state.tasks[id]
      if (!task) return state

      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...task,
            progress,
            ...(message && { message })
          }
        }
      }
    })
  },

  completeTask: (id, result) => {
    set(state => {
      const task = state.tasks[id]
      if (!task) return state

      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...task,
            status: 'completed',
            progress: 100,
            endTime: Date.now(),
            result
          }
        }
      }
    })
  },

  failTask: (id, message) => {
    set(state => {
      const task = state.tasks[id]
      if (!task) return state

      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...task,
            status: 'failed',
            message,
            endTime: Date.now()
          }
        }
      }
    })
  },

  getTaskStatus: (id) => {
    const task = get().tasks[id]
    return task?.status || 'idle'
  },

  getTask: (id) => {
    return get().tasks[id]
  },

  clearTask: (id) => {
    set(state => {
      const newTasks = { ...state.tasks }
      delete newTasks[id]
      return { tasks: newTasks }
    })
  },

  clearFinishedTasks: () => {
    set(state => {
      const newTasks: Record<string, Task> = {};
      for (const [id, task] of Object.entries(state.tasks)) {
        if (task.status === 'running') {
          newTasks[id] = task;
        }
      }
      return { tasks: newTasks };
    });
  },
  
  getLatestPCITask: () => {
    const state = get();
    // 获取所有PCI规划任务
    const pciTasks = Object.values(state.tasks)
      .filter(task => task.type === 'pci_planning');
    
    // 按结束时间降序排序，获取最新的任务
    const sortedTasks = pciTasks.sort((a, b) => {
      const endTimeA = a.endTime || a.startTime || 0;
      const endTimeB = b.endTime || b.startTime || 0;
      return endTimeB - endTimeA;
    });
    
    return sortedTasks.length > 0 ? sortedTasks[0] : undefined;
  }
}))
