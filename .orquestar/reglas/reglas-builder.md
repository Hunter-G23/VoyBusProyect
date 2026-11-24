# Reglas del builder

Basadas en las guías de Karpathy y en lo que miden los estudios de costo de agentes (2025–2026).
Valen igual para Claude, Codex y Antigravity.

## Antes de editar
- Escribe en 1–3 líneas el cambio que harás y cómo comprobarás que está hecho (el VERIFICAR del encargo).
  Si hay dos lecturas razonables de la tarea y cambian el resultado: `NEEDS_CONTEXT: <las dos opciones>`.
- Lee solo las RUTAS del encargo. Para ubicar algo más, `rg`/`grep` primero; abre rangos, no archivos
  enteros. **No vuelvas a leer un archivo que ya está en tu contexto**, salvo que lo hayas editado.
- Antes de editar un bloque, ten a la vista sus líneas exactas (±30): el parche falla menos.

## Al editar
- Cambio mínimo que cumple la aceptación. Solo los archivos PERMITIDOS.
- Sin relleno: nada de abstracciones "por si acaso", opciones que nadie pidió, manejo de errores
  imposibles, comentarios que repiten el código ni dependencias nuevas sin decirlo.
- No "mejores" código vecino ni su formato. Sigue el estilo del archivo.

## Verificar y parar
- Después de cada paso corre **solo el test dirigido** a ese cambio. La suite completa, **una vez al final**.
- Salidas largas van a archivo y lees solo los errores:
  `cmd > .orquestar/logs/<id>.log 2>&1; grep -n -A20 -E "FAIL|Error|Traceback|error" .orquestar/logs/<id>.log | head -80`
  Nunca recortes trazas, nombres de tests que fallan ni el primer error.
- **Cuando VERIFICAR pasa, terminas.** No revises el diff de nuevo, no corras tests extra, no
  "dejes todo más limpio". Lo que verifiques después de pasar es gasto puro.
- Si el mismo test falla 2 veces con el mismo enfoque: para y reporta
  `BLOCKED: <error exacto, qué probaste>`. No improvises un tercer enfoque.
- Respeta el TOPE de turnos. Si se acaba, reporta lo hecho y lo pendiente.

## Checkpoints y cuota
- Después de cada paso que deja el repo coherente, actualiza `.orquestar/tareas/<id>.md`
  (hecho, pendiente, siguiente paso, archivos tocados). 5–10 líneas.
- Si te avisan que tu proveedor está por quedarse sin cuota, o ves un error de cuota: escribe el
  checkpoint y termina con `BLOCKED: cuota`.
- Si tu tarea es un paso P del plan, al terminar márcalo `[x]` en `docs/IMPLEMENTATION-PLAN.md`.

## Respuesta final
Estado (DONE | BLOCKED | NEEDS_CONTEXT), archivos tocados, salida final de VERIFICAR (≤10 líneas),
≤100 palabras. Nada más.
