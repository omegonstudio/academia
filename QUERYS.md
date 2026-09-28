Queries útiles para verificar persistencia de **estudiantes** y **profes** en `academia_dev`:

### Conteos rápidos
```sql
SELECT COUNT(*) AS students FROM students;
SELECT COUNT(*) AS teachers FROM teachers;
SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;
```

### Listar estudiantes (perfil + user)
```sql
SELECT
  s.id,
  s.first_name,
  s.last_name,
  s.level,
  s.is_active,
  u.email,
  u.role,
  u.is_active AS user_active,
  s.created_at,
  s.updated_at
FROM students s
JOIN users u ON u.id = s.user_id
ORDER BY s.created_at DESC;
```

### Listar profesores (perfil + user)
```sql
SELECT
  t.id,
  t.first_name,
  t.last_name,
  t.level,
  t.availability,
  t.is_active,
  u.email,
  u.role,
  u.is_active AS user_active,
  t.created_at,
  t.updated_at
FROM teachers t
JOIN users u ON u.id = t.user_id
ORDER BY t.created_at DESC;
```

### Integridad 1:1 (user ↔ perfil)
```sql
-- Users STUDENT sin fila en students
SELECT u.id, u.email
FROM users u
LEFT JOIN students s ON s.user_id = u.id
WHERE u.role = 'STUDENT' AND s.id IS NULL;

-- Users TEACHER sin fila en teachers
SELECT u.id, u.email
FROM users u
LEFT JOIN teachers t ON t.user_id = u.id
WHERE u.role = 'TEACHER' AND t.id IS NULL;

-- Perfiles cuyo user no tiene el rol esperado
SELECT s.id, u.email, u.role
FROM students s JOIN users u ON u.id = s.user_id
WHERE u.role <> 'STUDENT';

SELECT t.id, u.email, u.role
FROM teachers t JOIN users u ON u.id = t.user_id
WHERE u.role <> 'TEACHER';
```

### Asignación alumno → profe
```sql
SELECT
  s.first_name || ' ' || s.last_name AS student,
  t.first_name || ' ' || t.last_name AS teacher,
  ta.created_at
FROM teacher_assignments ta
JOIN students s ON s.id = ta.student_id
JOIN teachers t ON t.id = ta.teacher_id
ORDER BY ta.created_at DESC;
```

### Buscar uno concreto
```sql
-- por email
SELECT s.*, u.email
FROM students s
JOIN users u ON u.id = s.user_id
WHERE u.email = 'alguien@ejemplo.com';

SELECT t.*, u.email
FROM teachers t
JOIN users u ON u.id = t.user_id
WHERE u.email = 'profe@ejemplo.com';

-- por nombre
SELECT * FROM students
WHERE last_name ILIKE '%garcia%' OR first_name ILIKE '%garcia%';

SELECT * FROM teachers
WHERE last_name ILIKE '%garcia%' OR first_name ILIKE '%garcia%';
```

### Últimos creados (para ver si “acaba de persistir”)
```sql
SELECT 'student' AS kind, id, first_name, last_name, created_at
FROM students
UNION ALL
SELECT 'teacher', id, first_name, last_name, created_at
FROM teachers
ORDER BY created_at DESC
LIMIT 20;
```

Si creaste algo desde la UI y no aparece, mirá primero los conteos y luego el email en `users`; el perfil vive en `students` / `teachers` y el login en `users`.