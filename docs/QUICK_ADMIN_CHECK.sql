-- Quick check: Verify admin setup for grichfitz

-- 1. Check if admin role exists
SELECT 'Admin role exists' as check_type, COUNT(*) as count
FROM public.roles 
WHERE LOWER(name) = 'admin';

-- 2. Check if grichfitz has admin role
SELECT 
  'grichfitz admin status' as check_type,
  u.email,
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM public.user_role_links url
      JOIN public.roles r ON url.role_id = r.id
      WHERE url.user_id = u.id
        AND LOWER(r.name) = 'admin'
    ) THEN 'HAS admin role'
    ELSE 'NO admin role'
  END as status
FROM public.users u
WHERE u.email = 'grichfitz@hotmail.com';

-- 3. Check grichfitz group memberships
SELECT 
  'grichfitz memberships' as check_type,
  u.email,
  g.name as group_name
FROM public.users u
LEFT JOIN public.user_group_links ugl ON u.id = ugl.user_id
LEFT JOIN public.groups g ON ugl.group_id = g.id
WHERE u.email = 'grichfitz@hotmail.com'
ORDER BY g.name;

-- 4. If admin role missing, create it and assign to grichfitz
DO $$
DECLARE
  admin_role_id uuid;
  user_id_val uuid;
BEGIN
  -- Create admin role if missing
  INSERT INTO public.roles (name)
  VALUES ('admin')
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO admin_role_id;
  
  -- If role already exists, get its ID
  IF admin_role_id IS NULL THEN
    SELECT id INTO admin_role_id
    FROM public.roles
    WHERE LOWER(name) = 'admin'
    LIMIT 1;
  END IF;
  
  -- Get grichfitz user ID
  SELECT id INTO user_id_val
  FROM public.users
  WHERE email = 'grichfitz@hotmail.com'
  LIMIT 1;
  
  -- Assign admin role if both exist
  IF admin_role_id IS NOT NULL AND user_id_val IS NOT NULL THEN
    INSERT INTO public.user_role_links (user_id, role_id)
    VALUES (user_id_val, admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'Admin role assigned to grichfitz@hotmail.com';
  ELSE
    RAISE NOTICE 'Could not assign admin role - role_id: %, user_id: %', admin_role_id, user_id_val;
  END IF;
END $$;

-- 5. Verify assignment
SELECT 
  'Final check' as check_type,
  u.email,
  r.name as role_name,
  'Admin role assigned' as status
FROM public.users u
JOIN public.user_role_links url ON u.id = url.user_id
JOIN public.roles r ON url.role_id = r.id
WHERE u.email = 'grichfitz@hotmail.com'
  AND LOWER(r.name) = 'admin';
