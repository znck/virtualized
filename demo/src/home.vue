<script>
export default {}
</script>

<template>
  <div class="container page">
    <div class="route">
      <h1>Vue Virtual Renderer Demos</h1>
      <ul>
        <li>
          <router-link to="/demo/1d">Carousal &amp; List (1D)</router-link>
        </li>
        <li>
          <router-link to="/demo/2d">Table (2D)</router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<style>
.page {
  height: 100vh;
  width: 100vw;
}

.container {
  display: flex;
  flex-direction: column;
}

.route {
  flex: 1;
  flex-direction: column;
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 32px;
}
</style>