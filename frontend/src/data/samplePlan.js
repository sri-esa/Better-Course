import { buildPlan } from '../utils/buildPlan'

const v = (id, title, durationMinutes) => ({ id, title, durationMinutes })

// Topic in the format the scheduler expects.
// effort_hours = watch time for now. The AI member's effort estimate
// (watch time x difficulty factor) will replace this later.
const makeTopic = (id, name, difficulty, videos) => ({
  id,
  name,
  difficulty,
  effort_hours: videos.reduce((sum, x) => sum + x.durationMinutes, 0) / 60,
  video_ids: videos.map((x) => x.id),
  videos, // titles/durations for the plan page checkboxes
})

// Hardcoded sample topics. The real backend/AI replaces this data.
export const SAMPLE_TOPICS = [
  makeTopic('t1', 'Arrays & Strings', 'Easy', [
    v('v1', 'Introduction to Arrays', 18),
    v('v2', 'Two Pointers Technique', 25),
    v('v3', 'Sliding Window Explained', 32),
    v('v4', 'String Manipulation Basics', 22),
  ]),
  makeTopic('t2', 'Recursion', 'Medium', [
    v('v5', 'Recursion for Beginners', 28),
    v('v6', 'Recursion Call Stack', 20),
    v('v7', 'Backtracking Basics', 40),
  ]),
  makeTopic('t3', 'Linked Lists', 'Medium', [
    v('v8', 'Singly Linked List', 30),
    v('v9', 'Reversing a Linked List', 24),
    v('v10', 'Cycle Detection', 19),
  ]),
  makeTopic('t4', 'Stacks & Queues', 'Easy', [
    v('v11', 'Stack Implementation', 21),
    v('v12', 'Queue and Deque', 23),
    v('v13', 'Monotonic Stack', 35),
  ]),
  makeTopic('t5', 'Trees', 'Hard', [
    v('v14', 'Binary Tree Traversals', 38),
    v('v15', 'Binary Search Trees', 33),
    v('v16', 'Tree Height and Diameter', 27),
  ]),
  makeTopic('t6', 'Graphs', 'Hard', [
    v('v17', 'Graph Representation', 26),
    v('v18', 'BFS and DFS', 45),
    v('v19', "Dijkstra's Algorithm", 42),
  ]),
]

// Sample topics -> FRONTEND scheduler -> plan. (No scheduling happens in this file.)
export function buildSamplePlan({ playlistUrls, hoursPerWeek, targetDate = null, today }) {
  return buildPlan({
    title: 'Data Structures & Algorithms (sample plan)',
    playlistUrls,
    topics: SAMPLE_TOPICS,
    hoursPerWeek,
    targetDate,
    today, // optional; defaults to today's date inside buildPlan
  })
}