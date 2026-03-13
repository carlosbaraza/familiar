import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import styles from './ProjectSidebar.module.css'

// Generate a consistent color from project name
function getProjectColor(name: string): string {
  const colors = [
    '#5e6ad2', '#e89b3e', '#27ae60', '#e74c3c', '#9b59b6',
    '#3498db', '#1abc9c', '#f39c12', '#e67e22', '#2ecc71'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function ProjectSidebar(): React.JSX.Element | null {
  const openProjects = useWorkspaceStore((s) => s.openProjects)
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)
  const sidebarExpanded = useWorkspaceStore((s) => s.sidebarExpanded)
  const sidebarVisible = useWorkspaceStore((s) => s.sidebarVisible)
  const switchProject = useWorkspaceStore((s) => s.switchProject)
  const addProject = useWorkspaceStore((s) => s.addProject)
  const removeProject = useWorkspaceStore((s) => s.removeProject)
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar)
  const projectState = useTaskStore((s) => s.projectState)
  const loadProjectState = useTaskStore((s) => s.loadProjectState)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  if (!sidebarVisible) return null

  const handleSwitchProject = async (path: string): Promise<void> => {
    if (path === activeProjectPath) return
    await switchProject(path)
    // Reload project state for the newly active project
    // The main process has already switched the active project
    await window.api.setProjectRoot(path)
    await loadProjectState()
  }

  const handleAddProject = async (): Promise<void> => {
    const path = await addProject()
    if (path) {
      // Switch to the newly added project
      await handleSwitchProject(path)
    }
  }

  return (
    <div
      className={`${styles.sidebar} ${sidebarExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed}`}
      data-testid="project-sidebar"
    >
      {/* Toggle button */}
      <button
        className={styles.toggleButton}
        onClick={toggleSidebar}
        title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        data-testid="sidebar-toggle"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {sidebarExpanded ? (
            <polyline points="9 3 5 7 9 11" />
          ) : (
            <polyline points="5 3 9 7 5 11" />
          )}
        </svg>
      </button>

      {/* Project list */}
      <div className={styles.projectList}>
        {openProjects.map((project) => {
          const isActive = project.path === activeProjectPath
          const color = getProjectColor(project.name)
          const initial = project.name.charAt(0).toUpperCase()

          // Show unread notification count for active project
          const unread = isActive ? unreadCount() : 0

          return (
            <div
              key={project.path}
              className={`${styles.projectItem} ${isActive ? styles.projectItemActive : ''}`}
              onClick={() => handleSwitchProject(project.path)}
              title={project.path}
              data-testid={`project-item-${project.name}`}
            >
              <div className={styles.projectIconWrapper}>
                <div
                  className={styles.projectIcon}
                  style={{ backgroundColor: color }}
                >
                  {initial}
                </div>
                {!sidebarExpanded && unread > 0 && (
                  <span className={styles.iconBadge} data-testid={`badge-${project.name}`}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
              {sidebarExpanded && (
                <div className={styles.projectInfo}>
                  <span className={styles.projectName}>{project.name}</span>
                  {unread > 0 && (
                    <span className={styles.projectUnread}>{unread} unread</span>
                  )}
                </div>
              )}
              {sidebarExpanded && !isActive && openProjects.length > 1 && (
                <button
                  className={styles.removeButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeProject(project.path)
                  }}
                  title="Remove project"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="3" y1="3" x2="9" y2="9" />
                    <line x1="9" y1="3" x2="3" y2="9" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add project button */}
      <button
        className={styles.addButton}
        onClick={handleAddProject}
        title="Add project"
        data-testid="add-project-button"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="7" y1="3" x2="7" y2="11" />
          <line x1="3" y1="7" x2="11" y2="7" />
        </svg>
        {sidebarExpanded && <span>Add Project</span>}
      </button>
    </div>
  )
}
