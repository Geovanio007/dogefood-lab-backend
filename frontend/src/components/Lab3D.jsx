import React, { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, Cylinder, Environment } from '@react-three/drei';
import * as THREE from 'three';

// 3D Scientist Character (Shiba Inu)
function ShibaScientist({ mixing, position = [0, 0, 0] }) {
  const meshRef = useRef();
  
  return (
    <group position={position}>
      {/* Shiba Inu Body */}
      <Box ref={meshRef} args={[0.8, 1.2, 0.6]} position={[0, 0.6, 0]}>
        <meshStandardMaterial color="#D2691E" />
      </Box>
      
      {/* Head */}
      <Sphere args={[0.5]} position={[0, 1.5, 0]}>
        <meshStandardMaterial color="#DEB887" />
      </Sphere>
      
      {/* Ears */}
      <Box args={[0.15, 0.4, 0.1]} position={[-0.25, 1.8, 0]}>
        <meshStandardMaterial color="#D2691E" />
      </Box>
      <Box args={[0.15, 0.4, 0.1]} position={[0.25, 1.8, 0]}>
        <meshStandardMaterial color="#D2691E" />
      </Box>
      
      {/* Lab Coat */}
      <Box args={[1.0, 1.4, 0.8]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="white" />
      </Box>
      
      {/* Lab Equipment in hands */}
      {mixing && (
        <group position={[0.5, 1.0, 0]}>
          <Cylinder args={[0.1, 0.1, 0.3]} rotation={[0, 0, Math.PI / 4]}>
            <meshStandardMaterial color="#4A90E2" />
          </Cylinder>
        </group>
      )}
    </group>
  );
}

// 3D Mixing Station
function MixingStation({ position = [2, 0, 0], selectedIngredients = [], mixing = false }) {
  return (
    <group position={position}>
      {/* Base Table */}
      <Box args={[2, 0.1, 1.5]} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#8B4513" />
      </Box>
      
      {/* Table Legs */}
      {[[-0.8, 0.4, -0.6], [0.8, 0.4, -0.6], [-0.8, 0.4, 0.6], [0.8, 0.4, 0.6]].map((pos, i) => (
        <Box key={i} args={[0.1, 0.8, 0.1]} position={pos}>
          <meshStandardMaterial color="#654321" />
        </Box>
      ))}
      
      {/* Mixing Bowl */}
      <Sphere args={[0.3]} position={[0, 1.0, 0]} scale={[1, 0.6, 1]}>
        <meshStandardMaterial 
          color={mixing ? "#FF6B6B" : "#E0E0E0"} 
          transparent
          opacity={0.8}
        />
      </Sphere>
      
      {/* Ingredient Representations */}
      {selectedIngredients.slice(0, 5).map((_, index) => (
        <Sphere 
          key={index} 
          args={[0.05]} 
          position={[
            (Math.random() - 0.5) * 0.4, 
            1.1 + Math.random() * 0.2, 
            (Math.random() - 0.5) * 0.4
          ]}
        >
          <meshStandardMaterial color={`hsl(${index * 60}, 70%, 60%)`} />
        </Sphere>
      ))}
    </group>
  );
}

// 3D Ingredient Shelf
function IngredientShelf({ position = [-3, 0, 0], ingredients = [], onIngredientClick }) {
  return (
    <group position={position}>
      {/* Shelf Structure */}
      <Box args={[0.2, 3, 2]} position={[0, 1.5, 0]}>
        <meshStandardMaterial color="#8B4513" />
      </Box>
      
      {/* Shelf Levels */}
      {[0.5, 1.5, 2.5].map((y, shelfIndex) => (
        <Box key={shelfIndex} args={[0.4, 0.05, 2]} position={[0.1, y, 0]}>
          <meshStandardMaterial color="#D2691E" />
        </Box>
      ))}
      
      {/* Ingredient Containers */}
      {ingredients.slice(0, 9).map((ingredient, index) => {
        const shelfLevel = Math.floor(index / 3);
        const shelfPosition = (index % 3) - 1;
        
        return (
          <group
            key={ingredient.id}
            position={[0.2, 0.6 + shelfLevel, shelfPosition * 0.6]}
            onClick={() => onIngredientClick && onIngredientClick(ingredient.id)}
          >
            <Cylinder args={[0.15, 0.15, 0.3]}>
              <meshStandardMaterial color="#FFD700" />
            </Cylinder>
            
            {/* Ingredient Label (floating text) */}
            <Text
              position={[0, 0.4, 0]}
              fontSize={0.1}
              color="black"
              anchorX="center"
              anchorY="middle"
            >
              {ingredient.emoji}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// Main 3D Lab Component
const Lab3D = ({ 
  ingredients = [], 
  selectedIngredients = [], 
  mixing = false, 
  onIngredientSelect,
  className = "" 
}) => {
  const [cameraPosition] = useState([5, 3, 5]);

  return (
    <div className={`w-full h-96 rounded-xl overflow-hidden ${className}`}>
      <Canvas camera={{ position: cameraPosition, fov: 60 }}>
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, 5, -10]} intensity={0.5} color="#4A90E2" />
          
          {/* Environment */}
          <Environment preset="city" />
          
          {/* Lab Components */}
          <ShibaScientist mixing={mixing} position={[0, 0, 0]} />
          <MixingStation 
            position={[2, 0, 0]} 
            selectedIngredients={selectedIngredients}
            mixing={mixing}
          />
          <IngredientShelf 
            position={[-3, 0, 0]} 
            ingredients={ingredients}
            onIngredientClick={onIngredientSelect}
          />
          
          {/* Lab Floor */}
          <Box args={[12, 0.1, 8]} position={[0, -0.05, 0]}>
            <meshStandardMaterial color="#F0F8FF" />
          </Box>
          
          {/* Lab Walls */}
          <Box args={[0.2, 4, 8]} position={[-6, 2, 0]}>
            <meshStandardMaterial color="#E6F3FF" />
          </Box>
          <Box args={[12, 4, 0.2]} position={[0, 2, -4]}>
            <meshStandardMaterial color="#E6F3FF" />
          </Box>
          
          {/* Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxDistance={10}
            minDistance={3}
            maxPolarAngle={Math.PI / 2}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Lab3D;