import example from './examplemyschedule.json'
import { uid } from '../lib/storage.js'

// 示例课表：与示例数据同结构，载入时重新分配 id
export function sampleCourses() {
  return example.courses.map((course) => ({ ...course, id: uid() }))
}
